import type { SupabaseClient } from '@supabase/supabase-js';

import type { ClinicInvite } from '@/lib/clinics/schema';
import type { Logger } from '@/lib/logger';

import { profileUserId } from './clinic-access';

export type InviteDeps = { adminClient: SupabaseClient; logger: Logger };

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
    .insert({ name: invite.name, contact_email: invite.contact_email })
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
  const sent = await deps.adminClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (sent.error) {
    deps.logger.warn('clinic login link failed', { clinicId, reason: sent.error.message });
    return { status: 'invite_failed', clinicId };
  }
  return { status: 'ok', clinicId };
}

async function linkInvitedUser(
  deps: InviteDeps,
  clinicId: string,
  email: string,
): Promise<InviteResult> {
  const invited = await deps.adminClient.auth.admin.inviteUserByEmail(email);
  if (invited.error || !invited.data.user) {
    if (invited.error?.message.toLowerCase().includes('already')) {
      return { status: 'already_invited' };
    }
    deps.logger.warn('clinic invite email failed', { clinicId, reason: invited.error?.message });
    return { status: 'invite_failed', clinicId };
  }
  const profile = await deps.adminClient
    .from('profiles')
    .insert({ user_id: invited.data.user.id, role: 'clinic', clinic_id: clinicId });
  if (profile.error) {
    deps.logger.error('profile link failed', { clinicId, reason: profile.error.message });
    return { status: 'error', reason: 'profile insert failed' };
  }
  return { status: 'ok', clinicId };
}
