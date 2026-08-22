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

/** An account stays "invited" until it has actually been used once. */
export function signInState(lastSignInAt: string | null | undefined): 'active' | 'invited' {
  return lastSignInAt ? 'active' : 'invited';
}

export function deriveAccessState(
  clinic: { contact_email: string | null; profiles: ProfileLink },
  lastSignInByUser: Map<string, string | null>,
): AccessState {
  const userId = profileUserId(clinic.profiles);
  if (!userId) return clinic.contact_email ? 'none' : 'no_email';
  return signInState(lastSignInByUser.get(userId));
}
