export type ConversationStatRow = { created_at: string; detected_legal_area: string | null };

export type ConversationStats = {
  total: number;
  byDay: Array<{ day: string; count: number }>;
  byLegalArea: Array<{ legalArea: string; count: number }>;
};

const UNKNOWN_AREA = 'Unbekannt';

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/** Aggregates in app code — PostgREST has no group-by, and volumes are tiny. */
export function aggregateConversationStats(rows: ConversationStatRow[]): ConversationStats {
  const byDay = countBy(rows.map((row) => row.created_at.slice(0, 10)));
  const byArea = countBy(rows.map((row) => row.detected_legal_area ?? UNKNOWN_AREA));
  return {
    total: rows.length,
    byDay: [...byDay.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byLegalArea: [...byArea.entries()]
      .map(([legalArea, count]) => ({ legalArea, count }))
      .sort((a, b) => b.count - a.count),
  };
}
