import type { InviteResult } from '@/lib/admin/invite-clinic';
import type { ClinicSubmission } from '@/lib/clinics/schema';
import type { Logger } from '@/lib/logger';

import type { DirectoryMatch } from './directory';

export type ClinicRegistrationStore = {
  findByName: (name: string) => Promise<DirectoryMatch | null>;
  isEmailTaken: (email: string) => Promise<boolean>;
  createPending: (submission: ClinicSubmission) => Promise<string>;
  deletePending: (clinicId: string) => Promise<void>;
};

export type RegisterDeps = {
  store: ClinicRegistrationStore;
  logger: Logger;
  claimWithEmail: (clinicId: string, email: string) => Promise<InviteResult>;
};

export type RegisterResult =
  | { status: 'pending_review'; email: string }
  | { status: 'collision'; clinic: DirectoryMatch }
  | { status: 'email_taken' }
  | { status: 'error' };

export async function registerClinic(
  deps: RegisterDeps,
  submission: ClinicSubmission,
): Promise<RegisterResult> {
  try {
    const collision = await deps.store.findByName(submission.name);
    if (collision) return { status: 'collision', clinic: collision };
    if (await deps.store.isEmailTaken(submission.contact_email)) return { status: 'email_taken' };
    return await createPendingClinic(deps, submission);
  } catch (error) {
    deps.logger.warn('clinic registration failed', { reason: errorMessage(error) });
    return { status: 'error' };
  }
}

async function createPendingClinic(
  deps: RegisterDeps,
  submission: ClinicSubmission,
): Promise<RegisterResult> {
  const clinicId = await deps.store.createPending(submission);
  const invited = await deps.claimWithEmail(clinicId, submission.contact_email);
  if (invited.status !== 'ok') {
    await deps.store.deletePending(clinicId);
    deps.logger.warn('clinic registration invite failed', { clinicId, status: invited.status });
    return { status: invited.status === 'already_invited' ? 'email_taken' : 'error' };
  }
  deps.logger.info('clinic registration awaiting review', { clinicId });
  return { status: 'pending_review', email: submission.contact_email };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
