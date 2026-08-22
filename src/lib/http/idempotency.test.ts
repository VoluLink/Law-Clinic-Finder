import { describe, expect, it, vi } from 'vitest';

import { idempotencyKeySchema, runIdempotent, type IdempotencyStore } from './idempotency';

const EXPIRES_AT = new Date('2026-08-23T00:00:00.000Z');

function store(claim: IdempotencyStore['claim']): IdempotencyStore {
  return {
    claim,
    complete: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
}

describe(runIdempotent.name, () => {
  it('runs the operation once and records its result', async () => {
    const deps = store(vi.fn().mockResolvedValue(null));
    const operation = vi.fn().mockResolvedValue({ version: '3' });

    const outcome = await runIdempotent(deps, 'key-abcdefgh', EXPIRES_AT, operation);

    expect(outcome).toEqual({ status: 'executed', result: { version: '3' } });
    expect(deps.complete).toHaveBeenCalledWith('key-abcdefgh', { version: '3' });
  });

  it('replays a completed key without running the operation again', async () => {
    const record = { status: 'completed' as const, result: { version: '3' } };
    const deps = store(vi.fn().mockResolvedValue(record));
    const operation = vi.fn();

    const outcome = await runIdempotent(deps, 'key-abcdefgh', EXPIRES_AT, operation);

    expect(outcome).toEqual({ status: 'replayed', result: { version: '3' } });
    expect(operation).not.toHaveBeenCalled();
  });

  it('reports a concurrent attempt on the same key', async () => {
    const deps = store(vi.fn().mockResolvedValue({ status: 'in_progress', result: null }));

    await expect(runIdempotent(deps, 'key-abcdefgh', EXPIRES_AT, vi.fn())).resolves.toEqual({
      status: 'in_progress',
    });
  });

  it('does not record a result the caller declared effect-free', async () => {
    const deps = store(vi.fn().mockResolvedValue(null));
    const rejected = { status: 'rejected' };

    const outcome = await runIdempotent(
      deps,
      'key-abcdefgh',
      EXPIRES_AT,
      () => Promise.resolve(rejected),
      (result) => result.status !== 'rejected',
    );

    expect(outcome).toEqual({ status: 'executed', result: rejected });
    expect(deps.complete).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalledWith('key-abcdefgh');
  });

  it('releases the claim when the operation throws so a retry can proceed', async () => {
    const deps = store(vi.fn().mockResolvedValue(null));

    await expect(
      runIdempotent(deps, 'key-abcdefgh', EXPIRES_AT, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(deps.release).toHaveBeenCalledWith('key-abcdefgh');
  });
});

describe('idempotencyKeySchema', () => {
  it('rejects a key that is too short to be unique', () => {
    expect(idempotencyKeySchema.safeParse('short')).toMatchObject({ success: false });
  });

  it('rejects a key with a path separator', () => {
    expect(idempotencyKeySchema.safeParse('key/with/slash')).toMatchObject({ success: false });
  });
});
