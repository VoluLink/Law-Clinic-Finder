import { describe, expect, it } from 'vitest';

import { AuthError, requireRole } from './require-role';

type ProfileRow = { user_id: string; role: string; clinic_id: string | null };

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
    const supabase = fakeSupabase({
      claims: { sub: 'user-1' },
      profiles: [{ user_id: 'user-1', role: 'clinic', clinic_id: 'clinic-1' }],
    });
    await expect(requireRole(supabase as never, ['clinic'])).resolves.toEqual({
      role: 'clinic',
      clinic_id: 'clinic-1',
    });
  });

  it('returns the admin profile even when other profiles are visible', async () => {
    const supabase = fakeSupabase({
      claims: { sub: 'admin-1' },
      profiles: [
        { user_id: 'admin-1', role: 'admin', clinic_id: null },
        { user_id: 'clinic-9', role: 'clinic', clinic_id: 'clinic-9' },
      ],
    });
    await expect(requireRole(supabase as never, ['admin'])).resolves.toEqual({
      role: 'admin',
      clinic_id: null,
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
    const supabase = fakeSupabase({
      claims: { sub: 'user-1' },
      profiles: [{ user_id: 'user-1', role: 'clinic', clinic_id: 'clinic-1' }],
    });
    await expect(requireRole(supabase as never, ['admin'])).rejects.toMatchObject({ status: 403 });
  });

  it('throws 403 when no profile exists', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profiles: [] });
    await expect(requireRole(supabase as never, ['admin', 'clinic'])).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});
