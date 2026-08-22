import { describe, expect, it, vi } from 'vitest';

import { claimDailyChatQuota, type DailyQuotaDeps } from './daily-quota';

vi.mock('server-only', () => ({}));

const SESSION_ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const TOKEN = '0123456789abcdef0123456789abcdef';
const DEVICE_HASH = 'a'.repeat(64);
const RESET_AT = '2026-08-16T22:00:00.000Z';

function createDeps(data: unknown, error: { message: string } | null = null): DailyQuotaDeps {
  return {
    store: {
      claim: vi.fn().mockImplementation(async () => {
        if (error) throw new Error(error.message);
        return data;
      }),
    } as never,
    createToken: () => TOKEN,
    digestToken: vi.fn().mockResolvedValue(DEVICE_HASH),
    now: () => new Date('2026-08-15T10:00:00.000Z'),
  };
}

function request(cookie?: string): Request {
  return new Request('https://example.org/api/chat', {
    headers: cookie ? { cookie } : undefined,
  });
}

describe(claimDailyChatQuota, () => {
  it('creates an opaque, short-lived cookie and claims the first conversation', async () => {
    const deps = createDeps({ allowed: true, scope: null, resetAt: RESET_AT });
    const result = await claimDailyChatQuota(deps, request(), SESSION_ID);

    expect(deps.store.claim).toHaveBeenCalledWith(
      DEVICE_HASH,
      SESSION_ID,
      new Date('2026-08-15T10:00:00.000Z'),
    );
    expect(result).toMatchObject({ ok: true, allowed: true, resetAt: RESET_AT });
    expect(result.ok && result.setCookie).toContain('lcf_chat_quota=');
    expect(result.ok && result.setCookie).toContain('Path=/api/chat; HttpOnly; SameSite=Lax');
    expect(result.ok && result.setCookie).toContain('Expires=Sun, 16 Aug 2026 22:00:00 GMT');
  });

  it('reuses a valid cookie without sending another Set-Cookie header', async () => {
    const deps = createDeps({ allowed: true, scope: null, resetAt: RESET_AT });
    const result = await claimDailyChatQuota(
      deps,
      request(`theme=light; lcf_chat_quota=${TOKEN}`),
      SESSION_ID,
    );

    expect(deps.digestToken).toHaveBeenCalledWith(TOKEN);
    expect(result).toMatchObject({ ok: true, allowed: true, setCookie: undefined });
  });

  it('returns the midnight reset when a third conversation is denied', async () => {
    const deps = createDeps({ allowed: false, scope: 'day', resetAt: RESET_AT });
    const result = await claimDailyChatQuota(deps, request(), SESSION_ID);
    expect(result).toMatchObject({ ok: true, allowed: false, scope: 'day', resetAt: RESET_AT });
  });

  it('fails closed when the distributed store cannot claim the quota', async () => {
    const deps = createDeps(null, { message: 'database unavailable' });
    const result = await claimDailyChatQuota(deps, request(), SESSION_ID);
    expect(result).toEqual({ ok: false, reason: 'database unavailable' });
  });

  it('fails closed when the quota request throws', async () => {
    const deps = createDeps(null);
    vi.mocked(deps.store.claim).mockRejectedValue(new Error('network unavailable'));
    const result = await claimDailyChatQuota(deps, request(), SESSION_ID);
    expect(result).toEqual({ ok: false, reason: 'network unavailable' });
  });

  it('fails closed on an invalid database response', async () => {
    const result = await claimDailyChatQuota(createDeps({ allowed: 'yes' }), request(), SESSION_ID);
    expect(result).toEqual({ ok: false, reason: 'invalid quota response' });
  });
});
