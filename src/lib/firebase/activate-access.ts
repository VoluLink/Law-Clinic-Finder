import { Timestamp } from 'firebase-admin/firestore';

import { publishBlockers } from '@/lib/clinics/publish-requirements';

import { firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import {
  clinicDocumentSchema,
  profileDocumentSchema,
  type ClinicDocument,
  type ProfileDocument,
} from './documents';

function requirementFields(clinic: ClinicDocument) {
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

export function firstAccessUpdates(profile: ProfileDocument, clinic: ClinicDocument, now: Date) {
  if (profile.role !== 'clinic' || profile.accessStatus !== 'active' || profile.activatedAt) {
    return null;
  }
  const complete = publishBlockers(requirementFields(clinic)).length === 0;
  const publish = complete && clinic.approvalStatus === 'approved';
  return {
    profile: { activatedAt: now, updatedAt: now },
    ...(publish ? { clinic: { isPublished: true, updatedAt: now } } : {}),
  };
}

export async function activateFirstAccess(userId: string, now = new Date()): Promise<void> {
  const database = firebaseFirestore();
  const profileReference = database.collection('profiles').doc(userId);
  const published = await database.runTransaction(async (transaction) => {
    const profile = profileDocumentSchema.parse((await transaction.get(profileReference)).data());
    if (profile.role !== 'clinic' || !profile.clinicId) return false;
    const clinicReference = database.collection('clinics').doc(profile.clinicId);
    const clinic = clinicDocumentSchema.parse((await transaction.get(clinicReference)).data());
    const updates = firstAccessUpdates(profile, clinic, now);
    if (!updates) return false;
    transaction.update(profileReference, timestamps(updates.profile));
    if (updates.clinic) transaction.update(clinicReference, timestamps(updates.clinic));
    return Boolean(updates.clinic);
  });
  if (published) invalidateClinicDirectory();
}

function timestamps<T extends { updatedAt: Date }>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      field instanceof Date ? Timestamp.fromDate(field) : field,
    ]),
  );
}
