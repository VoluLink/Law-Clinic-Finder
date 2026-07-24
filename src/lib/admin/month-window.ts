/**
 * Month-scoped navigation for the admin dashboard. Statistics are retained for a
 * rolling year aligned to month boundaries: the oldest reachable month is always
 * twelve months before the current one, matching the `prune_expired_data` cutoff
 * `date_trunc('month', now()) - interval '12 months'`. All math is UTC so the app
 * and the database agree on where a month starts.
 */

export type YearMonth = { year: number; month: number };

/** Statistics stay visible for this many months back, aligned to month starts. */
export const RETENTION_MONTHS = 12;

const KEY_PATTERN = /^(\d{4})-(\d{2})$/;

function toKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): YearMonth | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Absolute month ordinal, so stepping and comparison ignore the year rollover. */
function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + (month - 1);
}

function fromIndex(index: number): string {
  return toKey({ year: Math.floor(index / 12), month: (index % 12) + 1 });
}

function indexOfKey(key: string): number {
  const parsed = parseMonthKey(key);
  if (!parsed) throw new Error(`invalid month key: ${key}`);
  return monthIndex(parsed);
}

export function currentMonthKey(now: Date | number = Date.now()): string {
  const date = new Date(now);
  return toKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
}

export function stepMonth(key: string, delta: number): string {
  return fromIndex(indexOfKey(key) + delta);
}

export function oldestRetainedMonthKey(now: Date | number = Date.now()): string {
  return stepMonth(currentMonthKey(now), -RETENTION_MONTHS);
}

/** UTC half-open interval [first of month, first of next month) for DB filters. */
export function monthRange(key: string): { startIso: string; endIso: string } {
  const parsed = parseMonthKey(key);
  if (!parsed) throw new Error(`invalid month key: ${key}`);
  const start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const end = new Date(Date.UTC(parsed.year, parsed.month, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function canGoPrev(key: string, now: Date | number = Date.now()): boolean {
  return indexOfKey(key) > indexOfKey(oldestRetainedMonthKey(now));
}

export function canGoNext(key: string, now: Date | number = Date.now()): boolean {
  return indexOfKey(key) < indexOfKey(currentMonthKey(now));
}

/** Clamps any requested month into the retained [oldest, current] range. */
export function clampMonthKey(key: string, now: Date | number = Date.now()): string {
  const current = currentMonthKey(now);
  if (!parseMonthKey(key)) return current;
  const floor = indexOfKey(oldestRetainedMonthKey(now));
  const ceil = indexOfKey(current);
  const requested = indexOfKey(key);
  if (requested < floor) return fromIndex(floor);
  if (requested > ceil) return current;
  return key;
}

export function formatMonthLabel(key: string, locale = 'de-DE'): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
