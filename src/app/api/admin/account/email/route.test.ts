import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminRoute = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/admin-guard', () => ({ requireAdminRoute }));

import { POST } from './route';

describe('POST /api/admin/account/email', () => {
  const updateUser = vi.fn();

  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({ error: null });
    requireAdminRoute.mockReset().mockResolvedValue({
      profile: { role: 'admin', clinic_id: null },
      supabase: { auth: { updateUser } },
    });
  });

  it('starts the secure email-change flow for the signed-in admin account', async () => {
    const request = new Request('http://localhost/api/admin/account/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'neu@example.org' }),
    });

    await expect(POST(request)).resolves.toMatchObject({ status: 200 });
    expect(updateUser).toHaveBeenCalledWith({ email: 'neu@example.org' });
  });
});
