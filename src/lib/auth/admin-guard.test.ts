import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireRole } from './require-role';
import { requireAdminRoute } from './admin-guard';

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
