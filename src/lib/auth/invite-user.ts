import type { SupabaseClient } from '@supabase/supabase-js';

import { authConfirmUrl } from './auth-redirect';

export type InvitedUser =
  | { status: 'ok'; userId: string }
  | { status: 'already_invited' }
  | { status: 'invite_failed'; reason?: string };

/**
 * Creates the auth user and sends Supabase's invite email. Shared by the clinic
 * and admin invite paths so both send the same mail through the same redirect;
 * the caller adds the profile row that gives the account its role.
 *
 * An "already exists" error is not a failure — it means the address was invited
 * before, which the callers translate into their own resend behaviour.
 */
export async function inviteAuthUser(
  adminClient: SupabaseClient,
  email: string,
): Promise<InvitedUser> {
  const redirectTo = await authConfirmUrl();
  const invited = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (invited.error || !invited.data.user) {
    if (invited.error?.message.toLowerCase().includes('already')) {
      return { status: 'already_invited' };
    }
    return { status: 'invite_failed', reason: invited.error?.message };
  }
  return { status: 'ok', userId: invited.data.user.id };
}
