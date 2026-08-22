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

/** Rolling weekly chart from Firestore's write-time daily counters. */
export function weeklyCountsFromDays(
  days: Record<string, number>,
  now: number,
  weeks = 8,
): Array<{ label: string; value: number }> {
  const buckets = new Array<number>(weeks).fill(0);
  for (const [day, count] of Object.entries(days)) {
    const createdAt = new Date(`${day}T00:00:00.000Z`).getTime();
    const week = Math.floor((now - createdAt) / MS_PER_DAY / DAYS_PER_WEEK);
    if (week >= 0 && week < weeks) buckets[week] += count;
  }
  return buckets
    .map((value, week) => ({
      label: weekStartLabel(now - (week + 1) * DAYS_PER_WEEK * MS_PER_DAY),
      value,
    }))
    .reverse();
}

const MONTH_COLUMN_LABELS = ['1.', '8.', '15.', '22.', '29.'];

/**
 * Splits one month's conversations into five day-of-month columns for the admin
 * bar chart. Callers pass rows already scoped to the month; a per-day chart would
 * be too dense (28–31 bars), so days bucket by week-of-month (1–7, 8–14, …, 29+).
 */
export function monthWeekCounts(createdAt: string[]): Array<{ label: string; value: number }> {
  const buckets = MONTH_COLUMN_LABELS.map(() => 0);
  for (const iso of createdAt) {
    const day = new Date(iso).getUTCDate();
    buckets[monthBucket(day)] += 1;
  }
  return buckets.map((value, index) => ({ label: MONTH_COLUMN_LABELS[index], value }));
}

export function monthWeekCountsFromDays(
  days: Record<string, number>,
): Array<{ label: string; value: number }> {
  const buckets = MONTH_COLUMN_LABELS.map(() => 0);
  for (const [date, count] of Object.entries(days)) {
    const day = Number(date.slice(-2));
    if (Number.isInteger(day) && day >= 1 && day <= 31) buckets[monthBucket(day)] += count;
  }
  return buckets.map((value, index) => ({ label: MONTH_COLUMN_LABELS[index], value }));
}

function monthBucket(day: number): number {
  return Math.min(MONTH_COLUMN_LABELS.length - 1, Math.floor((day - 1) / DAYS_PER_WEEK));
}

/** Share of conversations that ended with at least one matched clinic, as a percent. */
export function matchRate(rows: Array<{ matched_clinic_count: number | null }>): number {
  if (rows.length === 0) return 0;
  const matched = rows.filter((row) => (row.matched_clinic_count ?? 0) > 0).length;
  return Math.round((matched / rows.length) * 100);
}
