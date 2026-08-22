import { randomUUID } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';

import type { ClinicSubmission } from '@/lib/clinics/schema';
import type { DirectoryMatch } from '@/lib/signup/directory';
import type { ClinicRegistrationStore } from '@/lib/signup/handle-register';
import { maskEmail } from '@/lib/signup/mask-email';

import { firebaseAccessReviewStore } from './access-review-store';
import { firebaseFirestore } from './admin';
import { ClinicNameConflictError, clinicNameReservationId, readClinic } from './clinic-repository';
import { isEmailReserved } from './identity-reservations';
import { invalidateSignupDirectory } from './signup-directory';

async function findByName(name: string): Promise<DirectoryMatch | null> {
  const database = firebaseFirestore();
  const reservation = await database
    .collection('uniqueClinicNames')
    .doc(clinicNameReservationId(name))
    .get();
  const clinicId = reservation.data()?.clinicId;
  if (typeof clinicId !== 'string') return null;
  const [clinic, owner] = await Promise.all([
    readClinic(clinicId),
    database.collection('uniqueClinicOwners').doc(clinicId).get(),
  ]);
  if (!clinic) return null;
  return {
    id: clinic.id,
    name: clinic.name,
    region: clinic.region,
    claimed: owner.exists,
    hasContactEmail: Boolean(clinic.contact_email),
    maskedEmail: clinic.contact_email ? maskEmail(clinic.contact_email) : null,
  };
}

async function isEmailTaken(email: string): Promise<boolean> {
  const database = firebaseFirestore();
  return isEmailReserved(database, email);
}

function pendingClinic(submission: ClinicSubmission, now: Timestamp) {
  return {
    name: submission.name,
    description: submission.description,
    region: submission.region,
    website: submission.website,
    legalAreas: submission.legal_areas,
    targetClients: submission.target_clients,
    languages: submission.languages,
    requirements: submission.requirements,
    advisesClients: submission.advises_clients,
    isPublished: false,
    approvalStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

async function createPending(submission: ClinicSubmission): Promise<string> {
  const database = firebaseFirestore();
  const clinicId = randomUUID();
  const nameReference = database
    .collection('uniqueClinicNames')
    .doc(clinicNameReservationId(submission.name));
  await database.runTransaction(async (transaction) => {
    if ((await transaction.get(nameReference)).exists) throw new ClinicNameConflictError();
    const now = Timestamp.now();
    transaction.create(
      database.collection('clinics').doc(clinicId),
      pendingClinic(submission, now),
    );
    transaction.create(nameReference, { clinicId, name: submission.name, updatedAt: now });
    transaction.set(database.collection('clinicContacts').doc(clinicId), {
      contactEmail: submission.contact_email,
    });
  });
  invalidateSignupDirectory();
  return clinicId;
}

async function deletePending(clinicId: string): Promise<void> {
  await firebaseAccessReviewStore.deleteSelfRegistered(clinicId);
  invalidateSignupDirectory();
}

export const firebaseClinicRegistrationStore: ClinicRegistrationStore = {
  findByName,
  isEmailTaken,
  createPending,
  deletePending,
};
