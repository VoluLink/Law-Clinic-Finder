import { z } from 'zod';

import {
  clinicEditableSchema,
  clinicMemberSaveSchema,
  type ClinicEditable,
} from '@/lib/clinics/schema';
import { clinicNameReservationId } from '@/lib/clinics/name-reservation';
import { owesSubmissionNotice } from '@/lib/clinics/notification-state';

import { firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { clinicContactDocumentSchema, clinicDocumentSchema } from './documents';
import { invalidateSignupDirectory } from './signup-directory';

export type ClinicView = ClinicEditable & {
  id: string;
  is_published: boolean;
  approval_status: 'pending' | 'approved';
  /** Set only while a self-service pause is running. */
  hidden_until: string | null;
  hidden_reason: 'temporary' | 'permanent' | null;
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
    hidden_until: clinic.hiddenUntil ? clinic.hiddenUntil.toISOString() : null,
    hidden_reason: clinic.hiddenReason ?? null,
    created_at: clinic.createdAt.toISOString(),
    updated_at: clinic.updatedAt.toISOString(),
  };
}

/** `notifySubmission` reports that this write claimed the one-per-cycle notice
 *  for the admin; the caller owes the mail and must clear the mark if it fails. */
export async function saveMemberClinic(
  clinicId: string,
  input: unknown,
): Promise<{ notifySubmission: boolean }> {
  const id = z.string().uuid().parse(clinicId);
  const clinic = clinicMemberSaveSchema.parse(input);
  const database = firebaseFirestore();
  const clinicReference = database.collection('clinics').doc(id);
  const notifySubmission = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(clinicReference);
    const current = clinicDocumentSchema.parse(snapshot.data());
    await reserveClinicName(transaction, id, current.name, clinic.name);
    const now = new Date();
    const claim = owesSubmissionNotice({
      isPublished: current.isPublished,
      submissionNotifiedAt: current.submissionNotifiedAt ?? null,
    });
    transaction.update(clinicReference, {
      ...clinicUpdateDocument(clinic, now),
      ...(claim ? { submissionNotifiedAt: now } : {}),
    });
    writeContact(transaction, database.collection('clinicContacts').doc(id), clinic.contact_email);
    return claim;
  });
  invalidateClinicDirectory();
  invalidateSignupDirectory();
  return { notifySubmission };
}

function writeContact(
  transaction: FirebaseFirestore.Transaction,
  reference: FirebaseFirestore.DocumentReference,
  contactEmail: string | null,
): void {
  if (contactEmail) transaction.set(reference, { contactEmail });
  else transaction.delete(reference);
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
