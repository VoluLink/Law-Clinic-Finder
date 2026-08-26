import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RateLimiter } from '@/lib/rate-limit';

const consumeDurableLimits = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase/durable-limit-store', () => ({ consumeDurableLimits }));

import { guardSignupRequest, guardSignupSubject } from './route-guard';

const limiter: RateLimiter = { isLimited: vi.fn().mockReturnValue(false) };

function request(): Request {
  return new Request('https://law-clinic-finder.web.app/api/signup/search', {
    method: 'POST',
    headers: {
      host: 'law-clinic-finder.web.app',
      origin: 'https://law-clinic-finder.web.app',
      'x-forwarded-for': '203.0.113.1, 192.0.2.1',
    },
  });
}

function configureFirebase(): void {
  vi.stubEnv('FIREBASE_PROJECT_ID', 'law-clinic-finder');
  vi.stubEnv('FIREBASE_DATABASE_ID', 'primary-eu');
  vi.stubEnv('FIREBASE_STORAGE_BUCKET', 'law-clinic-finder.firebasestorage.app');
  vi.stubEnv('IDENTITY_PLATFORM_API_KEY', 'public-web-api-key');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://law-clinic-finder.web.app');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(limiter.isLimited).mockReturnValue(false);
});

describe(guardSignupRequest, () => {
  it('accepts a same-origin request when Firebase is configured', () => {
    configureFirebase();
    expect(guardSignupRequest(request(), limiter)).toBeNull();
  });

  it('returns unavailable when Firebase configuration is incomplete', () => {
    configureFirebase();
    vi.stubEnv('IDENTITY_PLATFORM_API_KEY', '');
    expect(guardSignupRequest(request(), limiter)?.status).toBe(503);
  });

  it('rejects a cross-origin request', () => {
    configureFirebase();
    const crossOrigin = new Request(request(), { headers: { host: 'attacker.example' } });
    expect(guardSignupRequest(crossOrigin, limiter)?.status).toBe(403);
  });

  it('applies the per-IP limiter', () => {
    configureFirebase();
    vi.mocked(limiter.isLimited).mockReturnValue(true);
    expect(guardSignupRequest(request(), limiter)?.status).toBe(429);
    expect(limiter.isLimited).toHaveBeenCalledWith('203.0.113.1');
  });
});

/**
 * The durable half runs after the body is parsed, because what it counts — the
 * applicant's address — is in there.
 */
describe(guardSignupSubject, () => {
  const allowed = { allowed: true, hits: [new Date()] };

  it('counts a registration against both the address and its network', async () => {
    consumeDurableLimits.mockReset().mockResolvedValue(allowed);

    expect(await guardSignupSubject(request(), 'clinic@example.org')).toBeNull();
    expect(consumeDurableLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: 'application', subject: 'clinic@example.org' }),
      expect.objectContaining({ scope: 'network', subject: '203.0.113.0/24' }),
    ]);
  });

  it('counts only the network when the claim uses the address already on file', async () => {
    consumeDurableLimits.mockReset().mockResolvedValue(allowed);

    await guardSignupSubject(request(), undefined);

    expect(consumeDurableLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: 'network' }),
    ]);
  });

  it('refuses the application once a window is used up', async () => {
    consumeDurableLimits.mockReset().mockResolvedValue({ allowed: false, retryAfterMs: 3_600_000 });

    const response = await guardSignupSubject(request(), 'clinic@example.org');

    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBe('3600');
  });

  it('reserves nothing when the limit itself cannot be read', async () => {
    consumeDurableLimits.mockReset().mockRejectedValue(new Error('firestore unavailable'));

    expect((await guardSignupSubject(request(), 'clinic@example.org'))?.status).toBe(503);
  });
});
