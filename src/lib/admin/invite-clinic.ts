import type { SupabaseClient } from '@supabase/supabase-js';

import { authConfirmUrl } from '@/lib/auth/auth-redirect';
import { inviteAuthUser } from '@/lib/auth/invite-user';
import type { ClinicInvite } from '@/lib/clinics/schema';
import type { Logger } from '@/lib/logger';

import { profileUserId } from './clinic-access';

export type InviteDeps = { adminClient: SupabaseClient; logger: Logger };

/** Whether the invited account may act for its clinic right away. Admin-created
 *  invites are active; a self-service claim waits for approval. */
export type AccessStatus = 'pending' | 'active';

export type InviteResult =
  | { status: 'ok'; clinicId: string }
  | { status: 'invite_failed'; clinicId: string }
  | { status: 'already_invited' }
  | { status: 'error'; reason: string };

/**
 * Admin invite flow (service client): clinic row → auth invite email to the
 * org address → profile linking user and clinic. A failed email leaves the
 * clinic row in place; the UI offers re-inviting.
 */
export async function inviteClinic(deps: InviteDeps, invite: ClinicInvite): Promise<InviteResult> {
  const { data: clinic, error } = await deps.adminClient
    .from('clinics')
    .insert({
      name: invite.name,
      contact_email: invite.contact_email,
      approval_status: 'approved',
    })
    .select('id')
    .single();
  if (error || !clinic) {
    deps.logger.warn('clinic insert failed', { reason: error?.message });
    return { status: 'error', reason: 'clinic insert failed' };
  }
  return linkInvitedUser(deps, clinic.id, invite.contact_email);
}

/** Sends an initial invite or a fresh magic link for an existing pending account. */
export async function reinviteClinic(deps: InviteDeps, clinicId: string): Promise<InviteResult> {
  const { data: clinic } = await deps.adminClient
    .from('clinics')
    .select('id, contact_email, profiles(user_id)')
    .eq('id', clinicId)
    .maybeSingle();
  if (!clinic?.contact_email) return { status: 'error', reason: 'clinic has no contact email' };
  const userId = profileUserId(clinic.profiles);
  if (userId) return sendPendingLoginLink(deps, clinicId, userId, clinic.contact_email);
  return linkInvitedUser(deps, clinicId, clinic.contact_email);
}

async function sendPendingLoginLink(
  deps: InviteDeps,
  clinicId: string,
  userId: string,
  email: string,
): Promise<InviteResult> {
  const { data, error } = await deps.adminClient.auth.admin.getUserById(userId);
  if (error || !data.user) return { status: 'error', reason: 'invited user lookup failed' };
  if (data.user.last_sign_in_at) return { status: 'already_invited' };
  if (data.user.email?.toLowerCase() !== email.toLowerCase()) {
    return { status: 'error', reason: 'clinic email does not match invited user' };
  }
  const redirectTo = await authConfirmUrl();
  const sent = await deps.adminClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
  });
  if (sent.error) {
    deps.logger.warn('clinic login link failed', { clinicId, reason: sent.error.message });
    return { status: 'invite_failed', clinicId };
  }
  return { status: 'ok', clinicId };
}

/**
 * Invites the address and links it to the clinic. `accessStatus` decides whether
 * the account can act immediately (admin-created invite, where the admin already
 * vouched for the address) or has to wait for approval (self-service claim).
 */
export async function linkInvitedUser(
  deps: InviteDeps,
  clinicId: string,
  email: string,
  accessStatus: AccessStatus = 'active',
): Promise<InviteResult> {
  const invited = await inviteAuthUser(deps.adminClient, email);
  if (invited.status === 'already_invited') return { status: 'already_invited' };
  if (invited.status !== 'ok') {
    deps.logger.warn('clinic invite email failed', { clinicId, reason: invited.reason });
    return { status: 'invite_failed', clinicId };
  }
  const profile = await deps.adminClient.from('profiles').insert({
    user_id: invited.userId,
    role: 'clinic',
    clinic_id: clinicId,
    access_status: accessStatus,
  });
  if (profile.error) {
    deps.logger.error('profile link failed', { clinicId, reason: profile.error.message });
    return { status: 'error', reason: 'profile insert failed' };
  }
  return { status: 'ok', clinicId };
}
