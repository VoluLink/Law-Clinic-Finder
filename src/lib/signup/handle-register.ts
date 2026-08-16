import type { InviteResult } from '@/lib/admin/invite-clinic';
import type { ClinicSubmission } from '@/lib/clinics/schema';

import {
  DIRECTORY_COLUMNS,
  escapeLikePattern,
  toDirectoryMatch,
  type ClinicDirectoryRow,
  type DirectoryMatch,
} from './directory';
import type { SignupDeps } from './handle-search';

export type RegisterDeps = SignupDeps & {
  claimWithEmail: (clinicId: string, email: string) => Promise<InviteResult>;
  isEmailTaken: (email: string) => Promise<boolean>;
};

export type RegisterResult =
  | { status: 'pending_review'; email: string }
  | { status: 'collision'; clinic: DirectoryMatch }
  | { status: 'email_taken' }
  | { status: 'error' };

/**
 * New-clinic registration. A name collision never creates a duplicate — the
 * caller is redirected into the claim flow for the existing entry instead.
 *
 * The entry is created immediately but unapproved, because the login has to
 * point at a real clinics row (profiles.clinic_id is a foreign key). A database
 * constraint keeps an unapproved entry out of the public directory, so nothing
 * is visible until an admin approves it.
 */
export async function registerClinic(
  deps: RegisterDeps,
  submission: ClinicSubmission,
): Promise<RegisterResult> {
  const { data, error } = await deps.adminClient
    .from('clinics')
    .select(DIRECTORY_COLUMNS)
    .ilike('name', escapeLikePattern(submission.name))
    .maybeSingle();
  if (error) {
    deps.logger.warn('register collision check failed', { reason: error.message });
    return { status: 'error' };
  }
  if (data) return { status: 'collision', clinic: toDirectoryMatch(data as ClinicDirectoryRow) };
  if (await deps.isEmailTaken(submission.contact_email)) return { status: 'email_taken' };

  return createPendingClinic(deps, submission);
}

async function createPendingClinic(
  deps: RegisterDeps,
  submission: ClinicSubmission,
): Promise<RegisterResult> {
  const inserted = await deps.adminClient
    .from('clinics')
    .insert({ ...submission, approval_status: 'pending', is_published: false })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    deps.logger.warn('clinic registration insert failed', { reason: inserted.error?.message });
    return { status: 'error' };
  }

  const clinicId = (inserted.data as { id: string }).id;
  const invited = await deps.claimWithEmail(clinicId, submission.contact_email);
  if (invited.status !== 'ok') {
    // Without a login the entry is unreachable, so it must not linger in the
    // approval queue. Deleting it also removes any half-created account.
    await deps.adminClient.from('clinics').delete().eq('id', clinicId);
    deps.logger.warn('clinic registration invite failed', { clinicId, status: invited.status });
    return { status: invited.status === 'already_invited' ? 'email_taken' : 'error' };
  }
  deps.logger.info('clinic registration awaiting review', { clinicId });
  return { status: 'pending_review', email: submission.contact_email };
}
