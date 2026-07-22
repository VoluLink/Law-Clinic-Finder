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

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

function weekStartLabel(startMs: number): string {
  const date = new Date(startMs);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/** Rolling 7-day buckets ending at `now`, oldest → newest, for the 8-week chart. */
export function weeklyCounts(
  createdAt: string[],
  now: number,
  weeks = 8,
): Array<{ label: string; value: number }> {
  const buckets = new Array<number>(weeks).fill(0);
  for (const iso of createdAt) {
    const week = Math.floor((now - new Date(iso).getTime()) / MS_PER_DAY / DAYS_PER_WEEK);
    if (week >= 0 && week < weeks) buckets[week] += 1;
  }
  return buckets
    .map((value, week) => ({
      label: weekStartLabel(now - (week + 1) * DAYS_PER_WEEK * MS_PER_DAY),
      value,
    }))
    .reverse();
}

/** Share of conversations that ended with at least one matched clinic, as a percent. */
export function matchRate(rows: Array<{ matched_clinic_count: number | null }>): number {
  if (rows.length === 0) return 0;
  const matched = rows.filter((row) => (row.matched_clinic_count ?? 0) > 0).length;
  return Math.round((matched / rows.length) * 100);
}
