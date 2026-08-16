import { describe, expect, it, vi } from 'vitest';

import { createAdminClientMock, testLogger, type QueryResult } from '@/lib/signup/test-utils';

import type { InviteDeps } from './invite-clinic';
import { inviteAdmin, listAdmins, removeAdmin } from './manage-admins';

type FakeUser = { id: string; email: string; last_sign_in_at: string | null };

const CHEF: FakeUser = { id: 'admin-1', email: 'chef@example.com', last_sign_in_at: '2026-08-01' };
const NEU: FakeUser = { id: 'admin-2', email: 'neu@example.com', last_sign_in_at: null };

/**
 * `responses` feeds the query builder in call order. The admin-profile read is
 * always first, because both listAdmins and the uniqueness check start there.
 */
function createDeps(users: FakeUser[], responses: QueryResult[] = []) {
  const profileRows = { data: users.map((user) => ({ user_id: user.id })), error: null };
  const mock = createAdminClientMock([profileRows, ...responses]);
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const inviteUserByEmail = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
  const deps: InviteDeps = {
    adminClient: {
      ...mock.client,
      auth: {
        admin: {
          deleteUser,
          inviteUserByEmail,
          getUserById: async (id: string) => ({
            data: { user: users.find((user) => user.id === id) ?? null },
          }),
        },
      },
    } as never,
    logger: testLogger(),
  };
  return { deps, mock, deleteUser, inviteUserByEmail };
}

const noRows: QueryResult = { data: [], error: null };
const ok: QueryResult = { data: null, error: null };

describe(listAdmins, () => {
  it('reports each admin with its address and status', async () => {
    const { deps } = createDeps([CHEF, NEU]);
    await expect(listAdmins(deps)).resolves.toEqual([
      { userId: 'admin-1', email: 'chef@example.com', status: 'active' },
      { userId: 'admin-2', email: 'neu@example.com', status: 'invited' },
    ]);
  });

  it('returns nothing when no admin profile exists', async () => {
    const { deps } = createDeps([]);
    await expect(listAdmins(deps)).resolves.toEqual([]);
  });
});

describe(inviteAdmin, () => {
  it('invites a free address and records the admin profile', async () => {
    const { deps, mock, inviteUserByEmail } = createDeps([CHEF], [noRows, ok]);
    await expect(inviteAdmin(deps, 'zweite@example.com')).resolves.toEqual({ status: 'ok' });
    expect(inviteUserByEmail).toHaveBeenCalled();
    expect(mock.calls).toContainEqual([
      'insert',
      [{ user_id: 'new-user', role: 'admin', clinic_id: null, access_status: 'active' }],
    ]);
  });

  it('refuses an address that is already an admin', async () => {
    const { deps, inviteUserByEmail } = createDeps([CHEF]);
    await expect(inviteAdmin(deps, 'chef@example.com')).resolves.toEqual({ status: 'email_taken' });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('refuses an address already used by a law clinic', async () => {
    const clinicHit: QueryResult = { data: [{ id: 'clinic-1' }], error: null };
    const { deps, inviteUserByEmail } = createDeps([CHEF], [clinicHit]);
    await expect(inviteAdmin(deps, 'beratung@example.com')).resolves.toEqual({
      status: 'email_taken',
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
});

describe(removeAdmin, () => {
  it('removes another admin', async () => {
    const { deps, deleteUser } = createDeps([CHEF, NEU]);
    await expect(removeAdmin(deps, 'admin-2', 'admin-1')).resolves.toEqual({ status: 'ok' });
    expect(deleteUser).toHaveBeenCalledWith('admin-2');
  });

  it('refuses to remove the acting admin', async () => {
    const { deps, deleteUser } = createDeps([CHEF, NEU]);
    await expect(removeAdmin(deps, 'admin-1', 'admin-1')).resolves.toEqual({ status: 'self' });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('refuses to remove the last remaining admin', async () => {
    const { deps, deleteUser } = createDeps([CHEF]);
    await expect(removeAdmin(deps, 'admin-1', 'admin-2')).resolves.toEqual({
      status: 'last_admin',
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('reports an unknown account', async () => {
    const { deps, deleteUser } = createDeps([CHEF, NEU]);
    await expect(removeAdmin(deps, 'admin-9', 'admin-1')).resolves.toEqual({
      status: 'not_found',
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
