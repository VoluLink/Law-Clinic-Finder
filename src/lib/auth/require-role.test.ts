import { describe, expect, it } from 'vitest';

import { AuthError, requireRole } from './require-role';

function fakeSupabase(options: {
  claims?: object | null;
  profile?: { role: string; clinic_id: string | null } | null;
}) {
  return {
    auth: {
      getClaims: async () => ({
        data: options.claims === null ? null : { claims: options.claims },
      }),
    },
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: options.profile ?? null }) }),
    }),
  };
}

describe(requireRole, () => {
  it('returns the profile when the role is allowed', async () => {
    const supabase = fakeSupabase({
      claims: { sub: 'user-1' },
      profile: { role: 'clinic', clinic_id: 'clinic-1' },
    });
    await expect(requireRole(supabase as never, ['clinic'])).resolves.toEqual({
      role: 'clinic',
      clinic_id: 'clinic-1',
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
      profile: { role: 'clinic', clinic_id: 'clinic-1' },
    });
    await expect(requireRole(supabase as never, ['admin'])).rejects.toMatchObject({ status: 403 });
  });

  it('throws 403 when no profile exists', async () => {
    const supabase = fakeSupabase({ claims: { sub: 'user-1' }, profile: null });
    await expect(requireRole(supabase as never, ['admin', 'clinic'])).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});
