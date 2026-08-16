import { describe, expect, it } from 'vitest';

import { AuthError, requireActiveRole, requireRole } from './require-role';

type ProfileRow = {
  user_id: string;
  role: string;
  clinic_id: string | null;
  access_status: string;
};

const activeClinic = (userId = 'user-1'): ProfileRow => ({
  user_id: userId,
  role: 'clinic',
  clinic_id: 'clinic-1',
  access_status: 'active',
});

/**
 * Mimics PostgREST + RLS: an admin can read every profile row, so an unfiltered
 * read returns many and `.maybeSingle()` errors. Only a `user_id`-filtered read
 * narrows back to the caller's own row.
 */
function fakeSupabase(options: { claims?: object | null; profiles?: ProfileRow[] }) {
  const rows = options.profiles ?? [];
  const asMaybeSingle = (matched: ProfileRow[]) =>
    matched.length > 1
      ? { data: null, error: { message: 'multiple rows returned' } }
      : { data: matched[0] ?? null, error: null };
  return {
    auth: {
      getClaims: async () => ({
        data: options.claims === null ? null : { claims: options.claims },
      }),
    },
    from: () => ({
      select: () => ({
        maybeSingle: async () => asMaybeSingle(rows),
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => asMaybeSingle(rows.filter((row) => row.user_id === value)),
        }),
      }),
    }),
  };
}

describe(requireRole, () => {
  it('returns the profile when the role is allowed', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profiles: [activeClinic()] });
    await expect(requireRole(supabase as never, ['clinic'])).resolves.toEqual({
      role: 'clinic',
      clinic_id: 'clinic-1',
      access_status: 'active',
    });
  });

  it('returns the admin profile even when other profiles are visible', async () => {
    const supabase = fakeSupabase({
      claims: { sub: 'admin-1' },
      profiles: [
        { user_id: 'admin-1', role: 'admin', clinic_id: null, access_status: 'active' },
        activeClinic('clinic-9'),
      ],
    });
    await expect(requireRole(supabase as never, ['admin'])).resolves.toEqual({
      role: 'admin',
      clinic_id: null,
      access_status: 'active',
    });
  });

  it('throws 401 when not signed in', async () => {
    const supabase = fakeSupabase({ claims: null });
    await expect(requireRole(supabase as never, ['clinic'])).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });

  it('throws 403 when the role is not allowed', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profiles: [activeClinic()] });
    await expect(requireRole(supabase as never, ['admin'])).rejects.toMatchObject({ status: 403 });
  });

  it('throws 403 when no profile exists', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profiles: [] });
    await expect(requireRole(supabase as never, ['admin', 'clinic'])).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('still resolves a pending profile, so the caller can route it to the waiting page', async () => {
    const supabase = fakeSupabase({
      claims: { sub: 'user-1' },
      profiles: [{ ...activeClinic(), access_status: 'pending' }],
    });
    await expect(requireRole(supabase as never, ['clinic'])).resolves.toMatchObject({
      access_status: 'pending',
    });
  });
});

describe(requireActiveRole, () => {
  it('returns the profile when access is active', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profiles: [activeClinic()] });
    await expect(requireActiveRole(supabase as never, ['clinic'])).resolves.toMatchObject({
      clinic_id: 'clinic-1',
    });
  });

  it('throws 403 while the claim still awaits admin approval', async () => {
    const supabase = fakeSupabase({
      claims: { sub: 'user-1' },
      profiles: [{ ...activeClinic(), access_status: 'pending' }],
    });
    await expect(requireActiveRole(supabase as never, ['clinic'])).rejects.toMatchObject({
      name: 'AuthError',
      status: 403,
    });
  });
});
