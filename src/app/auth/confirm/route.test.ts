import { describe, expect, it, vi } from 'vitest';

import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

// The route imports server-only Supabase modules for its GET handler; the units
// under test take their client as a parameter or are pure.
vi.mock('server-only', () => ({}));

import { autoPublishClinic, autoPublishTarget, markAccessActivated } from './route';

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
    expect(
      autoPublishTarget('invite', { role: 'clinic', clinic_id: 'c1', activated_at: null }),
    ).toBe('c1');
  });

  it('treats a resent magic link as first activation while access is still pending', () => {
    expect(
      autoPublishTarget('magiclink', { role: 'clinic', clinic_id: 'c1', activated_at: null }),
    ).toBe('c1');
  });

  it('ignores later magiclink logins so a hidden clinic is not re-published', () => {
    expect(
      autoPublishTarget('magiclink', {
        role: 'clinic',
        clinic_id: 'c1',
        activated_at: '2026-07-26T20:00:00Z',
      }),
    ).toBeNull();
  });

  it('ignores admins and clinic-less profiles', () => {
    expect(
      autoPublishTarget('invite', { role: 'admin', clinic_id: null, activated_at: null }),
    ).toBeNull();
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

describe(markAccessActivated, () => {
  it('records first access activation for the verified profile', async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({ is: vi.fn().mockResolvedValue({ error: null }) })),
    }));
    const client = { from: vi.fn(() => ({ update })) } as unknown as ReturnType<
      typeof createSupabaseAdminClient
    >;

    await expect(markAccessActivated(client, 'u1', new Date('2026-07-26T20:00:00Z'))).resolves.toBe(
      true,
    );
    expect(update).toHaveBeenCalledWith({ activated_at: '2026-07-26T20:00:00.000Z' });
  });
});
