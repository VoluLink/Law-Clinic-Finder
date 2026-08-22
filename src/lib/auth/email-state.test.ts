import { describe, expect, it } from 'vitest';

import {
  consumeEmailState,
  createEmailState,
  lookupEmailState,
  type EmailStateRecord,
  type EmailStateStore,
} from './email-state';

function memoryStore(): EmailStateStore & { records: Map<string, EmailStateRecord> } {
  const records = new Map<string, EmailStateRecord>();
  return {
    records,
    save: async (id, record) => void records.set(id, record),
    find: async (id) => records.get(id) ?? null,
    consume: async (id, codeHash, now) => {
      const record = records.get(id);
      if (!record || record.codeHash !== codeHash || record.expiresAt <= now) return null;
      records.delete(id);
      return record;
    },
    delete: async (id) => void records.delete(id),
  };
}

describe(createEmailState.name, () => {
  it('stores only hashes as keys and binds the action code', async () => {
    const store = memoryStore();
    const state = await createEmailState(
      store,
      {
        email: 'Clinic@Example.com',
        userId: 'user-id',
        purpose: 'login',
        actionCode: 'oob-action-code',
      },
      { randomBytes: () => Buffer.alloc(32, 7), now: () => new Date('2026-08-16T12:00:00Z') },
    );

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...store.records.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect([...store.records.values()][0]).toMatchObject({ email: 'clinic@example.com' });
    expect([...store.records.values()][0]?.codeHash).not.toContain('oob-action-code');
  });
});

describe(lookupEmailState.name, () => {
  it('rejects a state paired with another action code', async () => {
    const store = memoryStore();
    const state = await createEmailState(store, {
      email: 'clinic@example.com',
      userId: 'user-id',
      purpose: 'login',
      actionCode: 'correct-code',
    });

    await expect(lookupEmailState(store, state, 'wrong-code')).resolves.toBeNull();
  });

  it('rejects a state at its exact expiry boundary', async () => {
    const store = memoryStore();
    const createdAt = new Date('2026-08-16T12:00:00.000Z');
    const state = await createEmailState(
      store,
      {
        email: 'clinic@example.com',
        userId: 'user-id',
        purpose: 'login',
        actionCode: 'correct-code',
      },
      { randomBytes: () => Buffer.alloc(32, 7), now: () => createdAt },
    );

    const expiresAt = new Date('2026-08-16T12:15:00.000Z');
    await expect(lookupEmailState(store, state, 'correct-code', expiresAt)).resolves.toBeNull();
  });
});

describe(consumeEmailState.name, () => {
  it('can consume a valid state only once', async () => {
    const store = memoryStore();
    const state = await createEmailState(store, {
      email: 'clinic@example.com',
      userId: 'user-id',
      purpose: 'invite',
      actionCode: 'correct-code',
    });

    await expect(consumeEmailState(store, state, 'correct-code')).resolves.toMatchObject({
      purpose: 'invite',
    });
    await expect(consumeEmailState(store, state, 'correct-code')).resolves.toBeNull();
  });
});
