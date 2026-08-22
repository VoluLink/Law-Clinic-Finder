import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LogLine } from '@/lib/logger';

import { createLogStore, type LogRepository, type NewStoredLog } from './log-store';

function fakeRepository(error?: Error) {
  const writes: NewStoredLog[] = [];
  const repository: LogRepository = {
    write: vi.fn(async (log: NewStoredLog) => {
      if (error) throw error;
      writes.push(log);
    }),
    list: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  return { repository, writes };
}

function line(overrides: Partial<LogLine> = {}): LogLine {
  return { timestamp: '2026-07-21T10:00:00.000Z', level: 'error', msg: 'boom', ...overrides };
}

afterEach(() => vi.restoreAllMocks());

describe(createLogStore, () => {
  it('stores the structured line with a seven-day TTL', async () => {
    const { repository, writes } = fakeRepository();
    createLogStore({ repository }).persist(line({ reason: 'db down', clinicId: 'c1' }));
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      logged_at: '2026-07-21T10:00:00.000Z',
      level: 'error',
      msg: 'boom',
      fields: { reason: 'db down', clinicId: 'c1' },
      expires_at: '2026-07-28T10:00:00.000Z',
    });
  });

  it('stores null fields when the line has no context', async () => {
    const { repository, writes } = fakeRepository();
    createLogStore({ repository }).persist(line());
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].fields).toBeNull();
  });

  it('does not run a scheduled prune query', async () => {
    const { repository } = fakeRepository();
    createLogStore({ repository }).persist(line());
    await vi.waitFor(() => expect(repository.write).toHaveBeenCalledOnce());
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it('reports write failures on stderr without throwing', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const { repository } = fakeRepository(new Error('insert failed'));
    expect(() => createLogStore({ repository }).persist(line())).not.toThrow();
    await vi.waitFor(() =>
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('insert failed')),
    );
  });
});
