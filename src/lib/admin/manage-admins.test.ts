import { describe, expect, it, vi } from 'vitest';

import { testLogger } from '@/lib/signup/test-utils';

import { inviteAdmin, listAdmins, removeAdmin, type AdminAccountDeps } from './manage-admins';

const admins = [
  {
    userId: 'admin-1',
    email: 'chef@example.com',
    status: 'active' as const,
    createdAt: '2026-08-10T10:00:00.000Z',
  },
  {
    userId: 'admin-2',
    email: 'neu@example.com',
    status: 'invited' as const,
    createdAt: '2026-08-11T10:00:00.000Z',
  },
];

function dependencies(): AdminAccountDeps {
  return {
    store: {
      list: vi.fn().mockResolvedValue(admins),
      invite: vi.fn().mockResolvedValue({ status: 'ok' }),
      remove: vi.fn().mockResolvedValue({ status: 'ok' }),
    },
    logger: testLogger(),
  };
}

describe(listAdmins, () => {
  it('returns the accounts supplied by the identity store', async () => {
    expect(await listAdmins(dependencies())).toEqual(admins);
  });
});

describe(inviteAdmin, () => {
  it('delegates e-mail uniqueness and provisioning atomically', async () => {
    const deps = dependencies();
    expect(await inviteAdmin(deps, 'zweite@example.com')).toEqual({ status: 'ok' });
    expect(deps.store.invite).toHaveBeenCalledWith('zweite@example.com');
  });

  it('preserves an e-mail conflict result', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.invite).mockResolvedValue({ status: 'email_taken' });
    expect(await inviteAdmin(deps, 'chef@example.com')).toEqual({ status: 'email_taken' });
  });
});

describe(removeAdmin, () => {
  it('passes both identities to the transactional last-admin guard', async () => {
    const deps = dependencies();
    expect(await removeAdmin(deps, 'admin-2', 'admin-1')).toEqual({ status: 'ok' });
    expect(deps.store.remove).toHaveBeenCalledWith('admin-2', 'admin-1');
  });

  it('preserves the self-removal guard result', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.remove).mockResolvedValue({ status: 'self' });
    expect(await removeAdmin(deps, 'admin-1', 'admin-1')).toEqual({ status: 'self' });
  });

  it('preserves the last-admin guard result', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.remove).mockResolvedValue({ status: 'last_admin' });
    expect(await removeAdmin(deps, 'admin-1', 'admin-2')).toEqual({ status: 'last_admin' });
  });
});
