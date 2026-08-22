import { describe, expect, it } from 'vitest';

import { readOptimisticSession } from './proxy-session';

function token(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

describe(readOptimisticSession, () => {
  it('reads routing claims from an unexpired Firebase session cookie', () => {
    const cookie = `other=1; __session=${token({ exp: 2_000, role: 'clinic', accessStatus: 'active' })}`;
    expect(readOptimisticSession(cookie, 1_000_000)).toEqual({ role: 'clinic', pending: false });
  });

  it('recognizes a pending clinic claim', () => {
    const cookie = `__session=${token({ exp: 2_000, role: 'clinic', accessStatus: 'pending' })}`;
    expect(readOptimisticSession(cookie, 1_000_000)).toEqual({ role: 'clinic', pending: true });
  });

  it('rejects an expired cookie', () => {
    const cookie = `__session=${token({ exp: 900, role: 'admin', accessStatus: 'active' })}`;
    expect(readOptimisticSession(cookie, 1_000_000)).toEqual({ role: null, pending: false });
  });

  it('fails closed on malformed content', () => {
    expect(readOptimisticSession('__session=not-a-jwt', 1_000_000)).toEqual({
      role: null,
      pending: false,
    });
  });
});
