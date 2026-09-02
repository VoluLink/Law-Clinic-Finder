/** Derived, never stored: a clinic has no access column — it is inferred from
 *  its contact email, whether a login profile was created, and whether that
 *  user has ever signed in. */
export type AccessState = 'active' | 'invited' | 'none' | 'no_email';

/** An account stays "invited" until it has actually been used once. */
export function signInState(lastSignInAt: string | null | undefined): 'active' | 'invited' {
  return lastSignInAt ? 'active' : 'invited';
}
