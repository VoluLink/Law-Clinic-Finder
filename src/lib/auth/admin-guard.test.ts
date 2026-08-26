import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireRole } from './require-role';
import { requireAdminRoute, requirePrivilegedAdminRoute } from './admin-guard';

vi.mock('./require-role', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('./require-role')>();
  return { ...original, requireRole: vi.fn() };
});

const loadRole = vi.mocked(requireRole);

function request(origin = 'https://law-clinic-finder.web.app'): Request {
  return new Request('https://law-clinic-finder.web.app/api/admin/settings', {
    method: 'PUT',
    headers: { host: 'law-clinic-finder.web.app', origin },
  });
}

describe(requireAdminRoute, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadRole.mockResolvedValue({
      user_id: 'admin-1',
      email: 'admin@example.test',
      auth_time: 1,
      role: 'admin',
      clinic_id: null,
      access_status: 'active',
    });
  });

  it('rejects a cross-origin mutation before reading the session', async () => {
    const result = await requireAdminRoute(request('https://attacker.example'));

    expect('response' in result ? result.response.status : null).toBe(403);
    expect(loadRole).not.toHaveBeenCalled();
  });

  it('authorizes a same-origin mutation', async () => {
    await expect(requireAdminRoute(request())).resolves.toMatchObject({ userId: 'admin-1' });
  });

  it('keeps read-only route checks independent of the Origin header', async () => {
    await expect(requireAdminRoute()).resolves.toMatchObject({ userId: 'admin-1' });
  });
});

describe(requirePrivilegedAdminRoute, () => {
  const SIGNED_IN_AT = 1_800_000_000;

  beforeEach(() => {
    vi.resetAllMocks();
    loadRole.mockResolvedValue({
      user_id: 'admin-1',
      email: 'admin@example.test',
      auth_time: SIGNED_IN_AT,
      role: 'admin',
      clinic_id: null,
      access_status: 'active',
    });
  });

  function at(secondsAfterSignIn: number): Date {
    return new Date((SIGNED_IN_AT + secondsAfterSignIn) * 1_000);
  }

  it('allows a destructive action moments after signing in', async () => {
    await expect(requirePrivilegedAdminRoute(request(), at(30))).resolves.toMatchObject({
      userId: 'admin-1',
    });
  });

  /* The point of the gate: a five-day session means a cookie stolen on Monday
   * could otherwise still add an admin on Friday. */
  it('refuses a destructive action from a long-lived session', async () => {
    const result = await requirePrivilegedAdminRoute(request(), at(6 * 60 * 60));

    expect('response' in result ? result.response.status : null).toBe(401);
  });

  it('tells the client to re-authenticate rather than just failing', async () => {
    const result = await requirePrivilegedAdminRoute(request(), at(6 * 60 * 60));
    const body = 'response' in result ? await result.response.json() : null;

    expect(body).toMatchObject({ code: 'reauth_required' });
  });

  it('refuses a session that carries no sign-in time at all', async () => {
    loadRole.mockResolvedValue({
      user_id: 'admin-1',
      email: 'admin@example.test',
      auth_time: undefined,
      role: 'admin',
      clinic_id: null,
      access_status: 'active',
    });

    const result = await requirePrivilegedAdminRoute(request(), at(0));

    expect('response' in result ? result.response.status : null).toBe(401);
  });

  it('still rejects cross-origin before anything else', async () => {
    const result = await requirePrivilegedAdminRoute(request('https://attacker.example'), at(0));

    expect('response' in result ? result.response.status : null).toBe(403);
  });
});
