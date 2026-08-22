import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminRoute = vi.hoisted(() => vi.fn());
const requestEmailChange = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/admin-guard', () => ({ requireAdminRoute }));
vi.mock('@/lib/auth/email-change', () => ({ requestEmailChange }));

import { POST } from './route';

function request(): Request {
  return new Request('http://localhost/api/admin/account/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'neu@example.org' }),
  });
}

describe('POST /api/admin/account/email', () => {
  beforeEach(() => {
    requestEmailChange.mockReset().mockResolvedValue({ status: 'sent' });
    requireAdminRoute.mockReset().mockResolvedValue({
      userId: 'admin-user',
      email: 'alt@example.org',
      authTime: 1_755_000_000,
    });
  });

  it('starts a verified change for the recently authenticated admin', async () => {
    await expect(POST(request())).resolves.toMatchObject({ status: 200 });
    expect(requestEmailChange).toHaveBeenCalledWith(expect.anything(), {
      userId: 'admin-user',
      currentEmail: 'alt@example.org',
      newEmail: 'neu@example.org',
      authTime: 1_755_000_000,
    });
  });

  it('asks the admin to sign in again when recent authentication is required', async () => {
    requestEmailChange.mockResolvedValue({ status: 'reauth_required' });
    const response = await POST(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'reauth_required' });
  });
});
