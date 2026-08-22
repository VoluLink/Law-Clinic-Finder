import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RateLimiter } from '@/lib/rate-limit';

import { guardSignupRequest } from './route-guard';

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
