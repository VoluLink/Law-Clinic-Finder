import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authConfirmUrl } from './auth-redirect';

const headerValues = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));

const configured = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => headerValues.clear());
afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = configured;
});

describe(authConfirmUrl, () => {
  it('uses the configured site url', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://law-clinic-finder.de';
    await expect(authConfirmUrl()).resolves.toBe('https://law-clinic-finder.de/auth/confirm');
  });

  it('ignores a trailing slash on the configured url', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://law-clinic-finder.de/';
    await expect(authConfirmUrl()).resolves.toBe('https://law-clinic-finder.de/auth/confirm');
  });

  /**
   * The regression this guards: the helper used to fall back to
   * window.location.origin, which is absent in a route handler. It returned
   * null there, emailRedirectTo was dropped, and the emailed link went to the
   * project's Site URL — the landing page — instead of /auth/confirm.
   */
  it('falls back to the request origin when no site url is configured', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    headerValues.set('host', 'localhost:3000');
    await expect(authConfirmUrl()).resolves.toBe('http://localhost:3000/auth/confirm');
  });

  it('assumes https for a non-local host', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    headerValues.set('host', 'law-clinic-finder.de');
    await expect(authConfirmUrl()).resolves.toBe('https://law-clinic-finder.de/auth/confirm');
  });

  it('prefers the forwarded host and protocol behind a proxy', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    headerValues.set('host', 'internal:3000');
    headerValues.set('x-forwarded-host', 'law-clinic-finder.de');
    headerValues.set('x-forwarded-proto', 'https');
    await expect(authConfirmUrl()).resolves.toBe('https://law-clinic-finder.de/auth/confirm');
  });

  it('returns null when there is no host at all', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    await expect(authConfirmUrl()).resolves.toBeNull();
  });
});
