import { describe, expect, it, vi } from 'vitest';

import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

// The route pulls in server-only Supabase modules for its request handlers; the
// unit under test (publishBlock) takes its client as a parameter, so neutralise
// the import-time guard.
vi.mock('server-only', () => ({}));

import { publishBlock } from './route';

type StoredRow = Record<string, unknown> | null;

/** Minimal stub of the admin client's read chain used by publishBlock. */
function stubClient(row: StoredRow) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
    }),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>;
}

const COMPLETE = {
  name: 'Clinic',
  website: 'https://example.org',
  region: 'Köln',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  advises_clients: true,
  description: null,
};

describe('publishBlock', () => {
  it('allows publishing a complete stored row', async () => {
    expect(await publishBlock(stubClient(COMPLETE), 'c1', { is_published: true })).toBeNull();
  });

  it('refuses with 422 and names the missing stored field', async () => {
    const response = await publishBlock(stubClient({ ...COMPLETE, languages: null }), 'c1', {
      is_published: true,
    });
    expect(response?.status).toBe(422);
    await expect(response?.json()).resolves.toMatchObject({
      error: expect.stringContaining('Sprache'),
    });
  });

  it('merges incoming edits over the stored row before checking', async () => {
    const stored = { ...COMPLETE, website: null };
    const result = await publishBlock(stubClient(stored), 'c1', {
      website: 'https://neu.example',
      is_published: true,
    });
    expect(result).toBeNull();
  });

  it('returns 404 when the clinic does not exist', async () => {
    const response = await publishBlock(stubClient(null), 'missing', { is_published: true });
    expect(response?.status).toBe(404);
  });
});
