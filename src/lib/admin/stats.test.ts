import { describe, expect, it } from 'vitest';

import { monthWeekCountsFromDays, weeklyCountsFromDays } from './stats';

describe(weeklyCountsFromDays, () => {
  const now = new Date('2026-07-20T12:00:00Z').getTime();

  it('returns one bucket per week, oldest first, all zero without counters', () => {
    const weeks = weeklyCountsFromDays({}, now, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.every((week) => week.value === 0)).toBe(true);
  });

  it('adds pre-aggregated day counts into the newest bucket', () => {
    expect(weeklyCountsFromDays({ '2026-07-19': 3 }, now, 8)[7].value).toBe(3);
  });

  it('ignores days older than the window', () => {
    const weeks = weeklyCountsFromDays({ '2026-01-01': 5 }, now, 8);
    expect(weeks.reduce((sum, week) => sum + week.value, 0)).toBe(0);
  });
});

describe(monthWeekCountsFromDays, () => {
  it('returns five zeroed columns without counters', () => {
    expect(monthWeekCountsFromDays({})).toEqual([
      { label: '1.', value: 0 },
      { label: '8.', value: 0 },
      { label: '15.', value: 0 },
      { label: '22.', value: 0 },
      { label: '29.', value: 0 },
    ]);
  });

  it('buckets each day into its week-of-month column, clamping the last', () => {
    expect(
      monthWeekCountsFromDays({
        '2026-10-03': 2,
        '2026-10-10': 1,
        '2026-10-30': 1,
        '2026-10-31': 4,
      }).map((column) => column.value),
    ).toEqual([2, 1, 0, 0, 5]);
  });
});
