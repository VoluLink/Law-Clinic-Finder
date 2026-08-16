import { describe, expect, it, vi } from 'vitest';

import type { createSupabaseAdminClient } from '@/lib/supabase/admin';

// The route imports server-only Supabase modules for its GET handler; the units
// under test take their client as a parameter or are pure.
vi.mock('server-only', () => ({}));

import {
  autoPublishClinic,
  autoPublishTarget,
  destinationFor,
  markAccessActivated,
  verifyLink,
} from './route';

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

  it('never publishes for a claimant still awaiting approval', () => {
    expect(
      autoPublishTarget('invite', {
        role: 'clinic',
        clinic_id: 'c1',
        activated_at: null,
        access_status: 'pending',
      }),
    ).toBeNull();
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

describe('destinationFor', () => {
  it('sends an admin to the admin area', () => {
    expect(destinationFor({ role: 'admin', clinic_id: null, access_status: 'active' })).toBe(
      '/admin',
    );
  });

  it('sends an approved clinic to its portal', () => {
    expect(destinationFor({ role: 'clinic', clinic_id: 'c1', access_status: 'active' })).toBe(
      '/clinic',
    );
  });

  it('holds a claimant awaiting approval on the waiting page', () => {
    expect(destinationFor({ role: 'clinic', clinic_id: 'c1', access_status: 'pending' })).toBe(
      '/clinic/pending',
    );
  });

  it('names the reason when a verified login has no profile at all', () => {
    expect(destinationFor(null)).toBe('/login?error=no_access');
  });
});

describe(verifyLink, () => {
  const user = { id: 'u1' };

  function stubAuth(overrides: {
    verifyOtp?: ReturnType<typeof vi.fn>;
    exchangeCodeForSession?: ReturnType<typeof vi.fn>;
  }) {
    return {
      auth: {
        verifyOtp: overrides.verifyOtp ?? vi.fn(),
        exchangeCodeForSession: overrides.exchangeCodeForSession ?? vi.fn(),
      },
    } as never;
  }

  it('verifies a token-hash link from the custom template', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const client = stubAuth({ verifyOtp });

    await expect(verifyLink(client, { token_hash: 'abc', type: 'magiclink' })).resolves.toEqual({
      userId: 'u1',
      flow: 'token_hash',
      type: 'magiclink',
    });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'magiclink' });
  });

  // The stock {{ .ConfirmationURL }} template lands here after Supabase's own
  // verify step, carrying a PKCE code instead of a token hash.
  it('completes the code exchange from the stock template', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const client = stubAuth({ exchangeCodeForSession });

    await expect(verifyLink(client, { code: 'pkce-code' })).resolves.toEqual({
      userId: 'u1',
      flow: 'code',
      type: 'magiclink',
    });
    expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
  });

  it('rejects a link carrying neither a token hash nor a code', async () => {
    const client = stubAuth({});
    await expect(verifyLink(client, {})).resolves.toBeNull();
  });

  it('rejects an expired token hash', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'x' } });
    await expect(
      verifyLink(stubAuth({ verifyOtp }), { token_hash: 'abc', type: 'magiclink' }),
    ).resolves.toBeNull();
  });

  it('rejects a code that cannot be exchanged', async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: { message: 'x' } });
    await expect(
      verifyLink(stubAuth({ exchangeCodeForSession }), { code: 'x' }),
    ).resolves.toBeNull();
  });

  it('prefers the token hash when a link somehow carries both', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const exchangeCodeForSession = vi.fn();
    const client = stubAuth({ verifyOtp, exchangeCodeForSession });

    await expect(
      verifyLink(client, { token_hash: 'abc', type: 'invite', code: 'pkce-code' }),
    ).resolves.toMatchObject({ flow: 'token_hash' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
