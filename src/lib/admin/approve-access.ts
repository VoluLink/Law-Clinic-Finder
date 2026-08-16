import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import {
  publishBlockers,
  REQUIREMENT_COLUMNS,
  type ClinicRequirementFields,
} from '@/lib/clinics/publish-requirements';

import type { InviteDeps } from './invite-clinic';

export type ReviewResult = { status: 'ok' } | { status: 'not_found' } | { status: 'error' };

type PendingClinic = ClinicRequirementFields & { id: string; approval_status: string };

/**
 * Approve a self-service claimant: the entry joins the directory and the login
 * becomes active. Both fields move in one update because a database constraint
 * forbids a published entry that is not approved.
 *
 * Publishing still depends on completeness — approving an entry that is missing
 * required fields grants access without making it public, and the admin's
 * publish toggle stays the way to fix that.
 */
export async function approveAccess(deps: InviteDeps, clinicId: string): Promise<ReviewResult> {
  const { data } = await deps.adminClient
    .from('clinics')
    .select(`id, approval_status, ${REQUIREMENT_COLUMNS}`)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) return { status: 'not_found' };

  const complete = publishBlockers(data as unknown as PendingClinic).length === 0;
  const clinic = await deps.adminClient
    .from('clinics')
    .update({ approval_status: 'approved', is_published: complete })
    .eq('id', clinicId);
  if (clinic.error) {
    deps.logger.error('clinic approval failed', { clinicId, reason: clinic.error.message });
    return { status: 'error' };
  }

  const profile = await deps.adminClient
    .from('profiles')
    .update({ access_status: 'active' })
    .eq('clinic_id', clinicId);
  if (profile.error) {
    deps.logger.error('access approval failed', { clinicId, reason: profile.error.message });
    return { status: 'error' };
  }
  deps.logger.info('clinic access approved', { clinicId, published: complete });
  return { status: 'ok' };
}

/**
 * Reject a claimant. The login goes, which frees the single claim slot for the
 * next applicant. A self-registered entry goes with it, since nothing else
 * references it; an admin-created entry is kept but loses the address the
 * claimant supplied — otherwise the next claim would mail the rejected person.
 */
export async function rejectAccess(deps: InviteDeps, clinicId: string): Promise<ReviewResult> {
  const { data } = await deps.adminClient
    .from('clinics')
    .select('id, approval_status')
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) return { status: 'not_found' };
  const selfRegistered = (data as { approval_status: string }).approval_status === 'pending';

  try {
    if (selfRegistered) {
      // The delete trigger removes the linked login with the row.
      const { error } = await deps.adminClient.from('clinics').delete().eq('id', clinicId);
      if (error) throw new Error(error.message);
    } else {
      await revokeClinicAccess(deps.adminClient, clinicId, {
        unpublish: false,
        clearContactEmail: true,
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    deps.logger.error('access rejection failed', { clinicId, reason });
    return { status: 'error' };
  }
  deps.logger.info('clinic access rejected', { clinicId, selfRegistered });
  return { status: 'ok' };
}
