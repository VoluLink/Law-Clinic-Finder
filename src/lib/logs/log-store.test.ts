import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LogLine } from '@/lib/logger';

import { createLogStore } from './log-store';

type DbError = { message: string } | null;

/** Minimal stand-in for the two PostgREST calls the sink makes. */
function fakeClient(errors: { insert?: DbError; delete?: DbError } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const deletes: { column: string; value: string }[] = [];
  const client = {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push(row);
          return Promise.resolve({ error: errors.insert ?? null });
        },
        delete() {
          return {
            lt(column: string, value: string) {
              deletes.push({ column, value });
              return Promise.resolve({ error: errors.delete ?? null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserts, deletes };
}

function line(overrides: Partial<LogLine> = {}): LogLine {
  return { timestamp: '2026-07-21T10:00:00.000Z', level: 'error', msg: 'boom', ...overrides };
}

const MS_PER_DAY = 86_400_000;

afterEach(() => vi.restoreAllMocks());

describe(createLogStore, () => {
  it('inserts logged_at, level, msg and the remaining fields as jsonb', async () => {
    const { client, inserts } = fakeClient();
    createLogStore({ client, now: () => 0 }).persist(line({ reason: 'db down', clinicId: 'c1' }));
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0]).toEqual({
      logged_at: '2026-07-21T10:00:00.000Z',
      level: 'error',
      msg: 'boom',
      fields: { reason: 'db down', clinicId: 'c1' },
    });
  });

  it('stores null fields when the line carries only timestamp/level/msg', async () => {
    const { client, inserts } = fakeClient();
    createLogStore({ client, now: () => 0 }).persist(line());
    await vi.waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0].fields).toBeNull();
  });

  it('swallows insert errors and reports them on stderr instead of throwing', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { client } = fakeClient({ insert: { message: 'insert failed' } });
    const store = createLogStore({ client, now: () => 0 });
    expect(() => store.persist(line())).not.toThrow();
    await vi.waitFor(() =>
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('insert failed')),
    );
  });

  it('prunes rows past the retention window, at most once per interval', async () => {
    const { client, inserts, deletes } = fakeClient();
    let clock = 10 * MS_PER_DAY;
    const store = createLogStore({
      client,
      now: () => clock,
      retentionDays: 7,
      pruneIntervalMs: 3_600_000,
    });

    store.persist(line());
    await vi.waitFor(() => expect(deletes).toHaveLength(1));
    expect(deletes[0]).toEqual({
      column: 'logged_at',
      value: new Date(clock - 7 * MS_PER_DAY).toISOString(),
    });

    store.persist(line()); // same clock → inside the throttle window
    await vi.waitFor(() => expect(inserts).toHaveLength(2));
    expect(deletes).toHaveLength(1);

    clock += 3_600_000; // interval elapsed
    store.persist(line());
    await vi.waitFor(() => expect(deletes).toHaveLength(2));
  });
});
