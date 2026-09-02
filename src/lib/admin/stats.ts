const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

function weekStartLabel(startMs: number): string {
  const date = new Date(startMs);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/** Rolling 7-day buckets ending at `now`, oldest → newest, for the 8-week chart.
 *  Reads Firestore's write-time daily counters rather than expanding event rows. */
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
 * bar chart. Callers pass counters already scoped to the month; a per-day chart
 * would be too dense (28–31 bars), so days bucket by week-of-month (1–7, 8–14, …, 29+).
 */
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
