import type { SupabaseClient } from '@supabase/supabase-js';

/** Derived, never stored: a clinic has no access column — it is inferred from
 *  its contact email, whether a login profile was created, and whether that
 *  user has ever signed in. */
export type AccessState = 'active' | 'invited' | 'none' | 'no_email';

type ProfileLink = { user_id: string }[] | { user_id: string } | null;

export function profileUserId(profiles: ProfileLink): string | null {
  if (!profiles) return null;
  const first = Array.isArray(profiles) ? profiles[0] : profiles;
  return first?.user_id ?? null;
}

export function deriveAccessState(
  clinic: { contact_email: string | null; profiles: ProfileLink },
  lastSignInByUser: Map<string, string | null>,
): AccessState {
  const userId = profileUserId(clinic.profiles);
  if (!userId) return clinic.contact_email ? 'none' : 'no_email';
  return lastSignInByUser.get(userId) ? 'active' : 'invited';
}

/** Every auth user id → last_sign_in_at (service role; the member base is small). */
export async function loadLastSignInMap(
  adminClient: SupabaseClient,
): Promise<Map<string, string | null>> {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return new Map(data.users.map((user) => [user.id, user.last_sign_in_at ?? null]));
}
