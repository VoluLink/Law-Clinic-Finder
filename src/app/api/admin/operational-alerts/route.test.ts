import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAdmins = vi.hoisted(() => vi.fn());
const requirePrivilegedAdminRoute = vi.hoisted(() => vi.fn());
const selectOperationalAlertRecipient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin/manage-admins', () => ({ listAdmins }));
vi.mock('@/lib/admin/operational-alerts', () => ({ selectOperationalAlertRecipient }));
vi.mock('@/lib/auth/admin-guard', () => ({ requirePrivilegedAdminRoute }));

import { PUT } from './route';

function request(): Request {
  return new Request('http://localhost:3000/api/admin/operational-alerts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'selected-admin' }),
  });
}

describe('PUT /api/admin/operational-alerts', () => {
  beforeEach(() => {
    requirePrivilegedAdminRoute.mockReset().mockResolvedValue({ userId: 'acting-admin' });
    listAdmins.mockReset().mockResolvedValue([]);
    selectOperationalAlertRecipient.mockReset().mockResolvedValue({ status: 'ok' });
  });

  it('updates the recipient through the validated admin workflow', async () => {
    const response = await PUT(request());

    expect(response.status).toBe(200);
    expect(selectOperationalAlertRecipient).toHaveBeenCalledWith(
      [],
      expect.anything(),
      'selected-admin',
      expect.anything(),
    );
  });

  it('rejects a recipient that is not an active admin', async () => {
    selectOperationalAlertRecipient.mockResolvedValue({ status: 'invalid_admin' });
    await expect(PUT(request())).resolves.toMatchObject({ status: 409 });
  });
});
