import { describe, expect, it } from 'vitest';

import { RECENT_AUTH_SECONDS, recentlyAuthenticated } from './recent-auth';

const NOW = new Date('2026-08-22T12:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1_000);

describe(recentlyAuthenticated.name, () => {
  it('accepts a sign-in inside the window', () => {
    expect(recentlyAuthenticated(NOW_SECONDS - RECENT_AUTH_SECONDS + 1, NOW)).toBe(true);
  });

  it('rejects a sign-in older than the window', () => {
    expect(recentlyAuthenticated(NOW_SECONDS - RECENT_AUTH_SECONDS - 1, NOW)).toBe(false);
  });

  it('rejects a sign-in timestamped in the future', () => {
    expect(recentlyAuthenticated(NOW_SECONDS + 60, NOW)).toBe(false);
  });
});
