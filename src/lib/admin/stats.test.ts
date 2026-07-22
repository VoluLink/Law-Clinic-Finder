import { describe, expect, it } from 'vitest';

import { aggregateConversationStats, matchRate, weeklyCounts } from './stats';

const rows = [
  { created_at: '2026-07-16T09:00:00Z', detected_legal_area: 'Mietrecht' },
  { created_at: '2026-07-16T15:30:00Z', detected_legal_area: 'Asylrecht' },
  { created_at: '2026-07-17T08:00:00Z', detected_legal_area: 'Mietrecht' },
  { created_at: '2026-07-17T09:00:00Z', detected_legal_area: null },
];

describe(aggregateConversationStats, () => {
  it('returns empty stats for no rows', () => {
    expect(aggregateConversationStats([])).toEqual({ total: 0, byDay: [], byLegalArea: [] });
  });

  it('counts totals and groups by day in ascending order', () => {
    const stats = aggregateConversationStats(rows);
    expect(stats.total).toBe(4);
    expect(stats.byDay).toEqual([
      { day: '2026-07-16', count: 2 },
      { day: '2026-07-17', count: 2 },
    ]);
  });

  it('groups by legal area sorted by count descending', () => {
    const stats = aggregateConversationStats(rows);
    expect(stats.byLegalArea[0]).toEqual({ legalArea: 'Mietrecht', count: 2 });
    expect(stats.byLegalArea).toHaveLength(3);
  });

  it('labels missing legal areas as Unbekannt', () => {
    const stats = aggregateConversationStats(rows);
    expect(stats.byLegalArea).toContainEqual({ legalArea: 'Unbekannt', count: 1 });
  });
});

describe(weeklyCounts, () => {
  const now = new Date('2026-07-20T12:00:00Z').getTime();

  it('returns one bucket per week, oldest first, all zero for no rows', () => {
    const weeks = weeklyCounts([], now, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.every((week) => week.value === 0)).toBe(true);
  });

  it('counts a recent conversation into the newest (last) bucket', () => {
    const weeks = weeklyCounts(['2026-07-19T09:00:00Z'], now, 8);
    expect(weeks[7].value).toBe(1);
    expect(weeks[0].value).toBe(0);
  });

  it('ignores conversations older than the window', () => {
    const weeks = weeklyCounts(['2026-01-01T00:00:00Z'], now, 8);
    expect(weeks.reduce((sum, week) => sum + week.value, 0)).toBe(0);
  });
});

describe(matchRate, () => {
  it('is 0 for no conversations', () => {
    expect(matchRate([])).toBe(0);
  });

  it('is the rounded percent that matched at least one clinic', () => {
    const rate = matchRate([
      { matched_clinic_count: 2 },
      { matched_clinic_count: 0 },
      { matched_clinic_count: null },
    ]);
    expect(rate).toBe(33);
  });
});
