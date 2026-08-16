import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadProxySession } from '@/lib/supabase/proxy-session';

import { proxy } from './proxy';

vi.mock('@/lib/supabase/proxy-session', () => ({ loadProxySession: vi.fn() }));

const loadSession = vi.mocked(loadProxySession);

function sessionResponse(role: 'admin' | 'clinic' | null, pending = false) {
  return { response: new Response(null) as never, role, pending };
}

describe(proxy, () => {
  beforeEach(() => vi.resetAllMocks());

  it('redirects signed-out visitors to the login page', async () => {
    loadSession.mockResolvedValue(sessionResponse(null));
    const result = await proxy(new NextRequest('http://localhost/clinic'));
    expect(result.headers.get('location')).toBe('http://localhost/login');
  });

  it('redirects clinic users away from the admin area', async () => {
    loadSession.mockResolvedValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/admin/assistant'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic');
  });

  it('lets clinic users into the clinic area', async () => {
    loadSession.mockResolvedValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/clinic'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('lets admins into the admin area', async () => {
    loadSession.mockResolvedValue(sessionResponse('admin'));
    const result = await proxy(new NextRequest('http://localhost/admin'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('holds a pending claimant on the waiting page', async () => {
    loadSession.mockResolvedValue(sessionResponse('clinic', true));
    const result = await proxy(new NextRequest('http://localhost/clinic/statistics'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic/pending');
  });

  it('lets a pending claimant see the waiting page itself', async () => {
    loadSession.mockResolvedValue(sessionResponse('clinic', true));
    const result = await proxy(new NextRequest('http://localhost/clinic/pending'));
    expect(result.headers.get('location')).toBeNull();
  });

  it('sends an approved clinic away from the waiting page', async () => {
    loadSession.mockResolvedValue(sessionResponse('clinic'));
    const result = await proxy(new NextRequest('http://localhost/clinic/pending'));
    expect(result.headers.get('location')).toBe('http://localhost/clinic');
  });
});
