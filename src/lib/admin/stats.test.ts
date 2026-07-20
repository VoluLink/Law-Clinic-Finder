import { describe, expect, it } from 'vitest';

import { aggregateConversationStats } from './stats';

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
