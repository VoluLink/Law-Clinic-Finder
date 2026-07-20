import { reinviteClinic, type InviteDeps, type InviteResult } from './invite-clinic';

const SUBMISSION_COLUMNS =
  'name, contact_email, website, region, legal_areas, target_clients, ' +
  'languages, description, requirements';

type SubmissionRow = {
  name: string;
  contact_email: string;
  website: string | null;
  region: string | null;
  legal_areas: string;
  target_clients: string | null;
  languages: string | null;
  description: string | null;
  requirements: string | null;
};

export type ApproveResult =
  | { status: 'ok'; clinicId: string }
  | { status: 'invite_failed'; clinicId: string }
  | { status: 'not_found' }
  | { status: 'error'; reason: string };

/**
 * Approve a self-signup submission: insert as a published clinic, send the
 * access invite to its contact email, drop the submission from the queue.
 * An invite failure keeps the clinic row and surfaces `invite_failed` — the
 * admin re-invites via the existing button. A failed insert (e.g. duplicate
 * name) keeps the submission so nothing is lost.
 */
export async function approveSubmission(
  deps: InviteDeps,
  submissionId: string,
  invite: (clinicId: string) => Promise<InviteResult> = (clinicId) =>
    reinviteClinic(deps, clinicId),
): Promise<ApproveResult> {
  const { data } = await deps.adminClient
    .from('clinic_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('id', submissionId)
    .maybeSingle();
  if (!data) return { status: 'not_found' };
  // Untyped supabase client cannot infer rows from the column string.
  const submission = data as unknown as SubmissionRow;

  const inserted = await deps.adminClient
    .from('clinics')
    .insert({ ...submission, is_published: true })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    deps.logger.warn('submission approve failed', {
      submissionId,
      reason: inserted.error?.message,
    });
    return { status: 'error', reason: 'clinic insert failed' };
  }

  const invited = await invite(inserted.data.id);
  await rejectSubmission(deps, submissionId);
  const inviteOk = invited.status === 'ok' || invited.status === 'already_invited';
  return { status: inviteOk ? 'ok' : 'invite_failed', clinicId: inserted.data.id };
}

/** Reject (or clean up) a submission. Returns false when the delete failed. */
export async function rejectSubmission(deps: InviteDeps, submissionId: string): Promise<boolean> {
  const { error } = await deps.adminClient
    .from('clinic_submissions')
    .delete()
    .eq('id', submissionId);
  if (error) {
    deps.logger.warn('submission delete failed', { submissionId, reason: error.message });
  }
  return !error;
}
