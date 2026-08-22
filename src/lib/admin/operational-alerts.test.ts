import { describe, expect, it, vi } from 'vitest';

import { testLogger } from '@/lib/signup/test-utils';

import type { AdminAccount } from './manage-admins';
import {
  loadOperationalAlertRecipient,
  reconcileOperationalAlertRecipient,
  selectOperationalAlertRecipient,
  type OperationalAlertStore,
} from './operational-alerts';

const admins: AdminAccount[] = [
  {
    userId: 'new-admin',
    email: 'new@example.org',
    status: 'active',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
  {
    userId: 'old-admin',
    email: 'old@example.org',
    status: 'active',
    createdAt: '2026-08-10T10:00:00.000Z',
  },
  {
    userId: 'invited-admin',
    email: 'invited@example.org',
    status: 'invited',
    createdAt: '2026-08-01T10:00:00.000Z',
  },
];

function store(selectedUserId: string | null = null): OperationalAlertStore {
  return {
    readSelectedUserId: vi.fn().mockResolvedValue(selectedUserId),
    writeSelectedUserId: vi.fn().mockResolvedValue(true),
  };
}

describe(loadOperationalAlertRecipient, () => {
  it('defaults to the longest-standing active admin', async () => {
    await expect(loadOperationalAlertRecipient(admins, store(), testLogger())).resolves.toEqual({
      userId: 'old-admin',
      email: 'old@example.org',
      source: 'default',
    });
  });

  it('uses an explicit valid selection', async () => {
    await expect(
      loadOperationalAlertRecipient(admins, store('new-admin'), testLogger()),
    ).resolves.toEqual({ userId: 'new-admin', email: 'new@example.org', source: 'explicit' });
  });

  it('falls back when the stored admin is no longer eligible', async () => {
    const alertStore = store('invited-admin');
    const recipient = await loadOperationalAlertRecipient(admins, alertStore, testLogger());

    expect(recipient?.userId).toBe('old-admin');
    expect(recipient?.source).toBe('default');
  });
});

describe(selectOperationalAlertRecipient, () => {
  it('persists only an active admin id', async () => {
    const alertStore = store();
    await expect(
      selectOperationalAlertRecipient(admins, alertStore, 'new-admin', testLogger()),
    ).resolves.toEqual({
      status: 'ok',
      recipient: expect.objectContaining({ email: 'new@example.org' }),
    });
    expect(alertStore.writeSelectedUserId).toHaveBeenCalledWith('new-admin');
  });

  it('rejects an invited admin', async () => {
    await expect(
      selectOperationalAlertRecipient(admins, store(), 'invited-admin', testLogger()),
    ).resolves.toEqual({ status: 'invalid_admin' });
  });
});

describe(reconcileOperationalAlertRecipient, () => {
  it('persists the oldest active fallback after the selected admin is removed', async () => {
    const alertStore = store('removed-admin');
    await reconcileOperationalAlertRecipient(admins, alertStore, testLogger());

    expect(alertStore.writeSelectedUserId).toHaveBeenCalledWith('old-admin');
  });

  it('leaves a valid explicit selection unchanged', async () => {
    const alertStore = store('new-admin');
    await reconcileOperationalAlertRecipient(admins, alertStore, testLogger());

    expect(alertStore.writeSelectedUserId).not.toHaveBeenCalled();
  });
});
