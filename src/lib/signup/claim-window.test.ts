import { describe, expect, it } from 'vitest';

import { reserveClaimAttempt } from './claim-window';

const NOW = new Date('2025-06-15T12:00:00.000Z');
const MS_PER_DAY = 86_400_000;

describe(reserveClaimAttempt, () => {
  it('records the first attempt', () => {
    expect(reserveClaimAttempt([], NOW)).toEqual({ allowed: true, attempts: [NOW] });
  });

  it('keeps one recent attempt and records the second', () => {
    const first = new Date(NOW.getTime() - MS_PER_DAY);
    expect(reserveClaimAttempt([first], NOW)).toEqual({
      allowed: true,
      attempts: [first, NOW],
    });
  });

  it('blocks a third attempt and reports whole retry days', () => {
    const first = new Date(NOW.getTime() - 2 * MS_PER_DAY);
    const second = new Date(NOW.getTime() - MS_PER_DAY);
    expect(reserveClaimAttempt([first, second], NOW)).toEqual({
      allowed: false,
      retryDays: 5,
    });
  });

  it('drops attempts at the seven-day boundary', () => {
    const expired = new Date(NOW.getTime() - 7 * MS_PER_DAY);
    expect(reserveClaimAttempt([expired], NOW)).toEqual({ allowed: true, attempts: [NOW] });
  });

  it('sorts stored attempts before calculating the retry window', () => {
    const first = new Date(NOW.getTime() - 2 * MS_PER_DAY);
    const second = new Date(NOW.getTime() - MS_PER_DAY);
    expect(reserveClaimAttempt([second, first], NOW)).toEqual({
      allowed: false,
      retryDays: 5,
    });
  });
});
