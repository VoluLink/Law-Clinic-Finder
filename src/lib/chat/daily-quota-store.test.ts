import { describe, expect, it } from 'vitest';

import { applyQuotaClaim, quotaWindow } from './daily-quota-store';

const FIRST_SESSION = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const SECOND_SESSION = '4f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f608';
const THIRD_SESSION = '5f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f609';

describe(quotaWindow, () => {
  it('uses the Europe/Berlin calendar date', () => {
    expect(quotaWindow(new Date('2026-08-15T22:30:00.000Z')).date).toBe('2026-08-16');
  });

  it('resets at the next Berlin midnight during summer time', () => {
    expect(quotaWindow(new Date('2026-08-15T10:00:00.000Z')).resetAt).toBe(
      '2026-08-15T22:00:00.000Z',
    );
  });

  it('uses the correct reset across the daylight-saving transition', () => {
    expect(quotaWindow(new Date('2026-10-24T22:30:00.000Z')).resetAt).toBe(
      '2026-10-25T23:00:00.000Z',
    );
  });
});

describe(applyQuotaClaim, () => {
  it('starts a first session with one turn', () => {
    expect(applyQuotaClaim([], FIRST_SESSION)).toEqual({
      allowed: true,
      sessions: [{ sessionId: FIRST_SESSION, turnCount: 1 }],
    });
  });

  it('increments a known session', () => {
    const sessions = [{ sessionId: FIRST_SESSION, turnCount: 1 }];
    expect(applyQuotaClaim(sessions, FIRST_SESSION).sessions[0].turnCount).toBe(2);
  });

  it('denies a ninth turn in one session', () => {
    const sessions = [{ sessionId: FIRST_SESSION, turnCount: 8 }];
    expect(applyQuotaClaim(sessions, FIRST_SESSION).allowed).toBe(false);
  });

  it('permits a second conversation', () => {
    const sessions = [{ sessionId: FIRST_SESSION, turnCount: 1 }];
    expect(applyQuotaClaim(sessions, SECOND_SESSION).allowed).toBe(true);
  });

  it('denies a third conversation', () => {
    const sessions = [
      { sessionId: FIRST_SESSION, turnCount: 1 },
      { sessionId: SECOND_SESSION, turnCount: 1 },
    ];
    expect(applyQuotaClaim(sessions, THIRD_SESSION).allowed).toBe(false);
  });
});
