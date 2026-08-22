import { clinicAdminSchema, type ClinicAdmin } from '@/lib/clinics/schema';
import { publishBlockers } from '@/lib/clinics/publish-requirements';

export type StoredAdminClinic = ClinicAdmin & {
  approval_status: 'pending' | 'approved';
};

export type PreparedClinicUpdate =
  | { allowed: true; clinic: ClinicAdmin }
  | { allowed: false; reason: 'incomplete'; missing: string[] }
  | { allowed: false; reason: 'unapproved' };

export function prepareAdminClinicUpdate(
  current: StoredAdminClinic,
  incoming: Partial<ClinicAdmin>,
): PreparedClinicUpdate {
  const clinic = clinicAdminSchema.parse({ ...current, ...incoming });
  if (clinic.is_published && current.approval_status !== 'approved') {
    return { allowed: false, reason: 'unapproved' };
  }
  const missing = clinic.is_published ? publishBlockers(clinic) : [];
  if (missing.length > 0) return { allowed: false, reason: 'incomplete', missing };
  return { allowed: true, clinic };
}
