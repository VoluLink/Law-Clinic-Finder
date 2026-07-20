import type { ClinicSubmission } from '@/lib/clinics/schema';

import {
  DIRECTORY_COLUMNS,
  escapeLikePattern,
  toDirectoryMatch,
  type ClinicDirectoryRow,
  type DirectoryMatch,
} from './directory';
import type { SignupDeps } from './handle-search';

export type RegisterResult =
  { status: 'submitted' } | { status: 'collision'; clinic: DirectoryMatch } | { status: 'error' };

/**
 * New-clinic registration. A name collision never creates a duplicate — the
 * caller is redirected into the claim flow for the existing entry instead
 * (spec §8.6). Otherwise the submission lands in the admin approval queue.
 */
export async function registerClinic(
  deps: SignupDeps,
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

  const inserted = await deps.adminClient.from('clinic_submissions').insert(submission);
  if (inserted.error) {
    deps.logger.warn('clinic submission insert failed', { reason: inserted.error.message });
    return { status: 'error' };
  }
  return { status: 'submitted' };
}
