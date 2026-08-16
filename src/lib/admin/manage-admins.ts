import { isAdminEmail, isClinicEmail } from '@/lib/auth/email-uniqueness';
import { inviteAuthUser } from '@/lib/auth/invite-user';

import { signInState } from './clinic-access';
import type { InviteDeps } from './invite-clinic';

export type AdminAccount = {
  userId: string;
  email: string;
  status: 'active' | 'invited';
};

export type AdminInviteResult =
  { status: 'ok' } | { status: 'email_taken' } | { status: 'invite_failed' } | { status: 'error' };

export type AdminRemovalResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'self' }
  | { status: 'last_admin' }
  | { status: 'error' };

/** Admin accounts, read through their profile rows so the cost scales with the
 *  number of admins rather than the whole user base. */
export async function listAdmins(deps: InviteDeps): Promise<AdminAccount[]> {
  const { data, error } = await deps.adminClient
    .from('profiles')
    .select('user_id')
    .eq('role', 'admin');
  if (error) {
    deps.logger.warn('admin list failed', { reason: error.message });
    return [];
  }
  const ids = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  const users = await Promise.all(ids.map((id) => deps.adminClient.auth.admin.getUserById(id)));
  return users
    .map((result) => result.data.user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user?.email))
    .map((user) => ({
      userId: user.id,
      email: user.email as string,
      status: signInState(user.last_sign_in_at),
    }))
    .sort((a, b) => a.email.localeCompare(b.email, 'de'));
}

/**
 * Invite a second admin. Every admin has the same rights, so this is the whole
 * permission model — there is no hierarchy to configure. The address must not
 * already belong to a clinic, because one address carries exactly one role.
 */
export async function inviteAdmin(deps: InviteDeps, email: string): Promise<AdminInviteResult> {
  if (await isAdminEmail(deps.adminClient, email)) return { status: 'email_taken' };
  if (await isClinicEmail(deps.adminClient, email)) return { status: 'email_taken' };

  const invited = await inviteAuthUser(deps.adminClient, email);
  if (invited.status === 'already_invited') return { status: 'email_taken' };
  if (invited.status !== 'ok') {
    deps.logger.warn('admin invite email failed', { reason: invited.reason });
    return { status: 'invite_failed' };
  }
  const profile = await deps.adminClient
    .from('profiles')
    .insert({ user_id: invited.userId, role: 'admin', clinic_id: null, access_status: 'active' });
  if (profile.error) {
    deps.logger.error('admin profile link failed', { reason: profile.error.message });
    return { status: 'error' };
  }
  deps.logger.info('admin invited');
  return { status: 'ok' };
}

/**
 * Remove an admin. Two guards, both enforced here rather than in the UI: an
 * admin cannot remove themselves (a second admin has to), and the last
 * remaining admin cannot be removed at all — otherwise one click could lock the
 * project out of its own admin area for good.
 */
export async function removeAdmin(
  deps: InviteDeps,
  userId: string,
  actingUserId: string,
): Promise<AdminRemovalResult> {
  if (userId === actingUserId) return { status: 'self' };
  const admins = await listAdmins(deps);
  if (!admins.some((admin) => admin.userId === userId)) return { status: 'not_found' };
  if (admins.length <= 1) return { status: 'last_admin' };

  const { error } = await deps.adminClient.auth.admin.deleteUser(userId);
  if (error) {
    deps.logger.error('admin removal failed', { reason: error.message });
    return { status: 'error' };
  }
  deps.logger.info('admin removed');
  return { status: 'ok' };
}
