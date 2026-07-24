import { describe, expect, it, vi } from 'vitest';

import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

// The route imports server-only Supabase modules for its GET handler; the units
// under test take their client as a parameter or are pure.
vi.mock('server-only', () => ({}));

import { autoPublishClinic, autoPublishTarget } from './route';

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

function stubClient(row: Record<string, unknown> | null, onUpdate = vi.fn()) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
      update: (patch: unknown) => {
        onUpdate(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>;
}

describe('autoPublishTarget', () => {
  it('returns the clinic id on a clinic invite acceptance', () => {
    expect(autoPublishTarget('invite', { role: 'clinic', clinic_id: 'c1' })).toBe('c1');
  });

  it('ignores later magiclink logins so a hidden clinic is not re-published', () => {
    expect(autoPublishTarget('magiclink', { role: 'clinic', clinic_id: 'c1' })).toBeNull();
  });

  it('ignores admins and clinic-less profiles', () => {
    expect(autoPublishTarget('invite', { role: 'admin', clinic_id: null })).toBeNull();
    expect(autoPublishTarget('invite', null)).toBeNull();
  });
});

describe('autoPublishClinic', () => {
  it('publishes a complete clinic', async () => {
    const onUpdate = vi.fn();
    const published = await autoPublishClinic(stubClient(COMPLETE, onUpdate), 'u1', 'c1');
    expect(published).toBe(true);
    expect(onUpdate).toHaveBeenCalledWith({ is_published: true });
  });

  it('leaves an incomplete clinic a draft', async () => {
    const onUpdate = vi.fn();
    const published = await autoPublishClinic(
      stubClient({ ...COMPLETE, languages: null }, onUpdate),
      'u1',
      'c1',
    );
    expect(published).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
