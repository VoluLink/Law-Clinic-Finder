import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  challengeProvider,
  challengeRequired,
  DEFAULT_POW_DIFFICULTY,
  leadingZeroBits,
  powDifficulty,
  powPayload,
  verifyChallenge,
  verifyProofOfWork,
  verifyTurnstile,
} from './challenge';

const SESSION_ID = '3f1c2a5e-7b8d-4c1a-9e2f-0a1b2c3d4e5f';
const TEST_DIFFICULTY = 8;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Mirrors what the browser does, so the test proves both halves agree. */
async function solve(sessionId: string, difficulty: number): Promise<string> {
  for (let attempt = 0; attempt < 5_000_000; attempt += 1) {
    const nonce = String(attempt);
    const bytes = new TextEncoder().encode(powPayload(sessionId, nonce));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (leadingZeroBits(digest) >= difficulty) return nonce;
  }
  throw new Error('no solution found');
}

describe(leadingZeroBits, () => {
  it('counts a fully zero leading byte as eight bits', () => {
    expect(leadingZeroBits(new Uint8Array([0, 0xff]))).toBe(8);
  });

  it('counts partial leading zeros within a byte', () => {
    expect(leadingZeroBits(new Uint8Array([0x0f]))).toBe(4);
  });

  it('is zero when the first bit is set', () => {
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0);
  });
});

describe(verifyProofOfWork, () => {
  it('accepts a nonce that meets the difficulty', async () => {
    const nonce = await solve(SESSION_ID, TEST_DIFFICULTY);
    await expect(verifyProofOfWork(SESSION_ID, nonce, TEST_DIFFICULTY)).resolves.toBe(true);
  });

  it('rejects a nonce that does not', async () => {
    await expect(verifyProofOfWork(SESSION_ID, '0', 32)).resolves.toBe(false);
  });

  it('rejects a solution replayed into another conversation', async () => {
    const nonce = await solve(SESSION_ID, TEST_DIFFICULTY);
    const other = '11111111-2222-4333-8444-555555555555';
    await expect(verifyProofOfWork(other, nonce, TEST_DIFFICULTY)).resolves.toBe(false);
  });

  it('rejects a non-numeric nonce rather than hashing arbitrary input', async () => {
    await expect(verifyProofOfWork(SESSION_ID, '../etc', TEST_DIFFICULTY)).resolves.toBe(false);
  });
});

describe(challengeProvider, () => {
  it('defaults to the self-hosted proof of work', () => {
    expect(challengeProvider()).toBe('pow');
  });

  it('falls back to proof of work for an unknown provider', () => {
    vi.stubEnv('CHALLENGE_PROVIDER', 'hcaptcha');
    expect(challengeProvider()).toBe('pow');
  });

  it('selects turnstile when configured', () => {
    vi.stubEnv('CHALLENGE_PROVIDER', 'turnstile');
    expect(challengeProvider()).toBe('turnstile');
  });
});

describe(powDifficulty, () => {
  it('uses the default when unset', () => {
    expect(powDifficulty()).toBe(DEFAULT_POW_DIFFICULTY);
  });

  it('ignores an out-of-range value rather than trusting it', () => {
    vi.stubEnv('CHALLENGE_POW_DIFFICULTY', '999');
    expect(powDifficulty()).toBe(DEFAULT_POW_DIFFICULTY);
  });
});

describe(challengeRequired, () => {
  it('is off unless explicitly enabled, so local runs are never gated', () => {
    expect(challengeRequired()).toBe(false);
  });

  it('is on when enabled', () => {
    vi.stubEnv('CHALLENGE_ENABLED', 'true');
    expect(challengeRequired()).toBe(true);
  });
});

describe(verifyTurnstile, () => {
  it('fails closed when no secret is configured', async () => {
    await expect(verifyTurnstile('token', null)).resolves.toBe(false);
  });

  it('accepts a token Cloudflare confirms', async () => {
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true })));
    await expect(verifyTurnstile('token', '198.51.100.7')).resolves.toBe(true);
  });

  it('rejects a token Cloudflare denies', async () => {
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false })));
    await expect(verifyTurnstile('token', null)).resolves.toBe(false);
  });

  it('fails closed when the verification endpoint errors', async () => {
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(verifyTurnstile('token', null)).resolves.toBe(false);
  });

  it('never sends the secret anywhere but Cloudflare', async () => {
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    await verifyTurnstile('token', null);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
  });
});

describe(verifyChallenge, () => {
  it('routes to the configured provider', async () => {
    vi.stubEnv('CHALLENGE_PROVIDER', 'turnstile');
    vi.stubEnv('TURNSTILE_SECRET', 'secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true })));
    await expect(
      verifyChallenge({ sessionId: SESSION_ID, token: 'cf-token', clientIp: null }),
    ).resolves.toBe(true);
  });
});
