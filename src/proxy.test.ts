import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readOptimisticSession } from '@/lib/firebase/proxy-session';

import { config, proxy } from './proxy';

vi.mock('@/lib/firebase/proxy-session', () => ({ readOptimisticSession: vi.fn() }));

const loadSession = vi.mocked(readOptimisticSession);
const originalStagingEnvironment = {
  enabled: process.env.STAGING_ACCESS_ENABLED,
  username: process.env.STAGING_ACCESS_USERNAME,
  password: process.env.STAGING_ACCESS_PASSWORD,
};

function enableStagingAccess(): void {
  process.env.STAGING_ACCESS_ENABLED = 'true';
  process.env.STAGING_ACCESS_USERNAME = 'preview';
  process.env.STAGING_ACCESS_PASSWORD = 'a-strong-temporary-password';
}

function stagingAuthorization(): string {
  return `Basic ${Buffer.from('preview:a-strong-temporary-password').toString('base64')}`;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function sessionResponse(role: 'admin' | 'clinic' | null, pending = false) {
  return { role, pending };
}

describe(proxy, () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => {
    restoreEnvironment('STAGING_ACCESS_ENABLED', originalStagingEnvironment.enabled);
    restoreEnvironment('STAGING_ACCESS_USERNAME', originalStagingEnvironment.username);
    restoreEnvironment('STAGING_ACCESS_PASSWORD', originalStagingEnvironment.password);
  });

  it('challenges staging API requests before application routing', async () => {
    enableStagingAccess();
    const result = await proxy(new NextRequest('https://staging.example/api/chat'));
    expect({
      status: result.status,
      challenge: result.headers.get('www-authenticate'),
      cache: result.headers.get('cache-control'),
      sessionRead: loadSession.mock.calls.length,
    }).toEqual({
      status: 401,
      challenge: 'Basic realm="Law Clinic Finder staging", charset="UTF-8"',
      cache: 'no-store',
      sessionRead: 0,
    });
  });

  it('runs the staging gate for pages and API routes but not Next.js static assets', () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    expect({
      page: matches('/'),
      api: matches('/api/chat'),
      staticAsset: matches('/_next/static/app.js'),
    }).toEqual({ page: true, api: true, staticAsset: false });
  });

  it('removes valid staging credentials before forwarding the request', async () => {
    enableStagingAccess();
    const request = new NextRequest('https://staging.example/', {
      headers: { authorization: stagingAuthorization() },
    });
    const result = await proxy(request);
    expect({
      status: result.status,
      cache: result.headers.get('cache-control'),
      forwardedAuthorization: result.headers.get('x-middleware-request-authorization'),
    }).toEqual({
      status: 200,
      cache: 'private, no-store',
      forwardedAuthorization: null,
    });
  });

  it('replaces an untrusted request ID and forwards one correlation ID', async () => {
    const request = new NextRequest('https://staging.example/', {
      headers: { 'x-request-id': 'client-controlled' },
    });
    const result = await proxy(request);
    const responseId = result.headers.get('x-request-id');
    expect({
      responseId,
      forwardedId: result.headers.get('x-middleware-request-x-request-id'),
    }).toEqual({ responseId: expect.stringMatching(/^[0-9a-f-]{36}$/), forwardedId: responseId });
  });

  it('correlates staging access failures without forwarding the request', async () => {
    enableStagingAccess();
    const result = await proxy(new NextRequest('https://staging.example/'));
    expect(result.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('redirects signed-out visitors to the login page', async () => {
    loadSession.mockReturnValue(sessionResponse(null));
    const result = await proxy(new NextRequest('http://localhost/clinic'));
    expect(result.headers.get('location')).toBe('http://localhost/login');
  });

  it('redirects clinic users away from the admin area', async () => {
    loadSession.mockReturnValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/admin/assistant'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic');
  });

  it('lets clinic users into the clinic area', async () => {
    loadSession.mockReturnValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/clinic'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('lets admins into the admin area', async () => {
    loadSession.mockReturnValue(sessionResponse('admin'));
    const result = await proxy(new NextRequest('http://localhost/admin'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('holds a pending claimant on the waiting page', async () => {
    loadSession.mockReturnValue(sessionResponse('clinic', true));
    const result = await proxy(new NextRequest('http://localhost/clinic/statistics'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic/pending');
  });

  it('lets a pending claimant see the waiting page itself', async () => {
    loadSession.mockReturnValue(sessionResponse('clinic', true));
    const result = await proxy(new NextRequest('http://localhost/clinic/pending'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('sends an approved clinic away from the waiting page', async () => {
    loadSession.mockReturnValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/clinic/pending'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic');
  });
});
