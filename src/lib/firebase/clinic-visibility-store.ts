import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { memberBlockers } from '@/lib/clinics/publish-requirements';
import type { VisibilityUpdate } from '@/lib/clinics/visibility';

import { firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { clinicDocumentSchema } from './documents';

export type VisibilityResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'unapproved' }
  | { status: 'incomplete'; missing: string[] };

function requirementFields(clinic: z.infer<typeof clinicDocumentSchema>) {
  return {
    name: clinic.name,
    website: clinic.website,
    region: clinic.region,
    legal_areas: clinic.legalAreas,
    target_clients: clinic.targetClients,
    languages: clinic.languages,
    advises_clients: clinic.advisesClients,
    description: clinic.description,
  };
}

/**
 * Republishing re-runs the same completeness and approval gates the admin path
 * uses. A clinic must never be able to reappear in the directory incomplete, or
 * to publish an entry an admin has not approved, by pausing and unpausing it.
 * `contact_email` lives in `clinicContacts` and is unchanged by hiding, so it is
 * intentionally not re-checked here.
 */
function publishGuard(clinic: z.infer<typeof clinicDocumentSchema>): VisibilityResult | null {
  if (clinic.approvalStatus !== 'approved') return { status: 'unapproved' };
  const missing = memberBlockers(requirementFields(clinic)).filter(
    (key) => key !== 'contact_email',
  );
  return missing.length > 0 ? { status: 'incomplete', missing } : null;
}

export async function setClinicVisibility(
  clinicIdInput: string,
  update: VisibilityUpdate,
): Promise<VisibilityResult> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const database = firebaseFirestore();
  const reference = database.collection('clinics').doc(clinicId);
  const result = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return { status: 'not_found' } as const;
    const clinic = clinicDocumentSchema.parse(snapshot.data());
    const blocked = update.isPublished ? publishGuard(clinic) : null;
    if (blocked) return blocked;
    transaction.update(reference, {
      isPublished: update.isPublished,
      hiddenUntil: update.hiddenUntil ? Timestamp.fromDate(update.hiddenUntil) : null,
      hiddenReason: update.hiddenReason,
      updatedAt: Timestamp.now(),
    });
    return { status: 'ok' } as const;
  });
  if (result.status === 'ok') invalidateClinicDirectory();
  return result;
}
