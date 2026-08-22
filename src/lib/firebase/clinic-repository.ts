import { z } from 'zod';

import {
  clinicEditableSchema,
  clinicMemberSaveSchema,
  type ClinicEditable,
} from '@/lib/clinics/schema';
import { clinicNameReservationId } from '@/lib/clinics/name-reservation';

import { firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { clinicContactDocumentSchema, clinicDocumentSchema } from './documents';
import { invalidateSignupDirectory } from './signup-directory';

export type ClinicView = ClinicEditable & {
  id: string;
  is_published: boolean;
  approval_status: 'pending' | 'approved';
  created_at: string;
  updated_at: string;
};

export class ClinicNameConflictError extends Error {
  constructor() {
    super('Clinic name is already reserved');
    this.name = 'ClinicNameConflictError';
  }
}

export { clinicNameReservationId } from '@/lib/clinics/name-reservation';

export function clinicUpdateDocument(input: unknown, now: Date) {
  const clinic = clinicEditableSchema.parse(input);
  return {
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    website: clinic.website,
    legalAreas: clinic.legal_areas,
    targetClients: clinic.target_clients,
    languages: clinic.languages,
    requirements: clinic.requirements,
    advisesClients: clinic.advises_clients,
    updatedAt: now,
  };
}

export async function readClinic(clinicId: string): Promise<ClinicView | null> {
  const id = z.string().uuid().parse(clinicId);
  const database = firebaseFirestore();
  const [clinicSnapshot, contactSnapshot] = await Promise.all([
    database.collection('clinics').doc(id).get(),
    database.collection('clinicContacts').doc(id).get(),
  ]);
  if (!clinicSnapshot.exists) return null;
  const clinic = clinicDocumentSchema.parse(clinicSnapshot.data());
  const contact = contactSnapshot.exists
    ? clinicContactDocumentSchema.parse(contactSnapshot.data()).contactEmail
    : null;
  return {
    id,
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    contact_email: contact,
    website: clinic.website,
    legal_areas: clinic.legalAreas,
    target_clients: clinic.targetClients,
    languages: clinic.languages,
    requirements: clinic.requirements,
    advises_clients: clinic.advisesClients,
    is_published: clinic.isPublished,
    approval_status: clinic.approvalStatus,
    created_at: clinic.createdAt.toISOString(),
    updated_at: clinic.updatedAt.toISOString(),
  };
}

export async function saveMemberClinic(clinicId: string, input: unknown): Promise<void> {
  const id = z.string().uuid().parse(clinicId);
  const clinic = clinicMemberSaveSchema.parse(input);
  const database = firebaseFirestore();
  const clinicReference = database.collection('clinics').doc(id);
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(clinicReference);
    const current = clinicDocumentSchema.parse(snapshot.data());
    await reserveClinicName(transaction, id, current.name, clinic.name);
    transaction.update(clinicReference, clinicUpdateDocument(clinic, new Date()));
    const contactReference = database.collection('clinicContacts').doc(id);
    if (clinic.contact_email) {
      transaction.set(contactReference, { contactEmail: clinic.contact_email });
    } else {
      transaction.delete(contactReference);
    }
  });
  invalidateClinicDirectory();
  invalidateSignupDirectory();
}

export async function reserveClinicName(
  transaction: FirebaseFirestore.Transaction,
  clinicId: string,
  currentName: string,
  nextName: string,
): Promise<void> {
  const collection = firebaseFirestore().collection('uniqueClinicNames');
  const currentReference = collection.doc(clinicNameReservationId(currentName));
  const nextReference = collection.doc(clinicNameReservationId(nextName));
  const [current, next] = await Promise.all([
    transaction.get(currentReference),
    transaction.get(nextReference),
  ]);
  if (next.exists && next.data()?.clinicId !== clinicId) throw new ClinicNameConflictError();
  transaction.set(nextReference, { clinicId, name: nextName, updatedAt: new Date() });
  if (currentReference.path !== nextReference.path && current.data()?.clinicId === clinicId) {
    transaction.delete(currentReference);
  }
}
