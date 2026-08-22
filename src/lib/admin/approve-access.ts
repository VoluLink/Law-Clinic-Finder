import type { ClinicAccessStore } from '@/lib/clinics/revoke-access';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { publishBlockers, type ClinicRequirementFields } from '@/lib/clinics/publish-requirements';
import type { Logger } from '@/lib/logger';

export type ReviewResult = { status: 'ok' } | { status: 'not_found' } | { status: 'error' };

type PendingClinic = ClinicRequirementFields & {
  id: string;
  approval_status: 'pending' | 'approved';
};

export type AccessReviewStore = {
  readClinic: (clinicId: string) => Promise<PendingClinic | null>;
  approve: (clinicId: string, publish: boolean) => Promise<{ notifyPublication: boolean }>;
  deleteSelfRegistered: (clinicId: string) => Promise<void>;
};

export type AccessReviewDeps = {
  reviewStore: AccessReviewStore;
  accessStore: ClinicAccessStore;
  logger: Logger;
  /** Sends the "your entry is published" notice; never throws. */
  notifyPublication: (clinicId: string) => Promise<void>;
};

export async function approveAccess(
  deps: AccessReviewDeps,
  clinicId: string,
): Promise<ReviewResult> {
  const clinic = await deps.reviewStore.readClinic(clinicId);
  if (!clinic) return { status: 'not_found' };
  const publish = publishBlockers(clinic).length === 0;
  let claimed = false;
  try {
    claimed = (await deps.reviewStore.approve(clinicId, publish)).notifyPublication;
  } catch (error) {
    deps.logger.error('clinic approval failed', { clinicId, reason: errorMessage(error) });
    return { status: 'error' };
  }
  deps.logger.info('clinic access approved', { clinicId, published: publish });
  if (claimed) await deps.notifyPublication(clinicId);
  return { status: 'ok' };
}

export async function rejectAccess(
  deps: AccessReviewDeps,
  clinicId: string,
): Promise<ReviewResult> {
  const clinic = await deps.reviewStore.readClinic(clinicId);
  if (!clinic) return { status: 'not_found' };
  const selfRegistered = clinic.approval_status === 'pending';
  try {
    if (selfRegistered) await deps.reviewStore.deleteSelfRegistered(clinicId);
    else {
      await revokeClinicAccess(deps.accessStore, clinicId, {
        unpublish: false,
        clearContactEmail: true,
      });
    }
  } catch (error) {
    deps.logger.error('access rejection failed', { clinicId, reason: errorMessage(error) });
    return { status: 'error' };
  }
  deps.logger.info('clinic access rejected', { clinicId, selfRegistered });
  return { status: 'ok' };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
