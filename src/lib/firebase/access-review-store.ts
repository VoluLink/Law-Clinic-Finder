import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { AccessReviewStore } from '@/lib/admin/approve-access';
import { owesPublicationNotice } from '@/lib/clinics/notification-state';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { clinicNameReservationId, readClinic } from './clinic-repository';
import { clinicDocumentSchema, profileDocumentSchema } from './documents';
import { firebaseClinicAccessStore } from './revoke-clinic-access';

async function profileIdForClinic(clinicId: string): Promise<string> {
  const snapshot = await firebaseFirestore()
    .collection('profiles')
    .where('clinicId', '==', clinicId)
    .limit(2)
    .get();
  if (snapshot.size !== 1) throw new Error('clinic must have exactly one pending profile');
  return snapshot.docs[0].id;
}

/**
 * Firebase marks the address verified when the invited person signs in through
 * the emailed link, so this is the record of them actually answering it. Any
 * failure to establish that — no profile, no Auth user, an unreadable record —
 * counts as unverified rather than as permission to proceed.
 */
async function hasVerifiedIdentity(clinicIdInput: string): Promise<boolean> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  try {
    const userId = await profileIdForClinic(clinicId);
    return (await firebaseAdminAuth().getUser(userId)).emailVerified;
  } catch {
    return false;
  }
}

async function approve(
  clinicIdInput: string,
  publish: boolean,
): Promise<{ notifyPublication: boolean }> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const userId = await profileIdForClinic(clinicId);
  await firebaseAdminAuth().setCustomUserClaims(userId, {
    role: 'clinic',
    clinicId,
    accessStatus: 'active',
  });
  const database = firebaseFirestore();
  const notifyPublication = await database.runTransaction(async (transaction) => {
    const clinicReference = database.collection('clinics').doc(clinicId);
    const profileReference = database.collection('profiles').doc(userId);
    const [clinicSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(clinicReference),
      transaction.get(profileReference),
    ]);
    const clinic = clinicDocumentSchema.parse(clinicSnapshot.data());
    profileDocumentSchema.parse(profileSnapshot.data());
    const claim = owesPublicationNotice({
      wasPublished: clinic.isPublished,
      willBePublished: publish,
      publishNotifiedAt: clinic.publishNotifiedAt ?? null,
    });
    const now = Timestamp.now();
    transaction.update(clinicReference, {
      approvalStatus: 'approved',
      isPublished: publish,
      updatedAt: now,
      ...(publish && !clinic.isPublished ? { submissionNotifiedAt: null } : {}),
      ...(claim ? { publishNotifiedAt: now } : {}),
    });
    transaction.update(profileReference, {
      accessStatus: 'active',
      expiresAt: null,
      updatedAt: now,
    });
    return claim;
  });
  invalidateClinicDirectory();
  return { notifyPublication };
}

async function deleteSelfRegistered(clinicIdInput: string): Promise<void> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  await firebaseClinicAccessStore.revoke(clinicId, {
    unpublish: true,
    clearContactEmail: true,
  });
  const database = firebaseFirestore();
  await database.runTransaction(async (transaction) => {
    const clinicReference = database.collection('clinics').doc(clinicId);
    const clinic = clinicDocumentSchema.parse((await transaction.get(clinicReference)).data());
    const nameReference = database
      .collection('uniqueClinicNames')
      .doc(clinicNameReservationId(clinic.name));
    const reservation = await transaction.get(nameReference);
    if (reservation.data()?.clinicId === clinicId) transaction.delete(nameReference);
    transaction.delete(clinicReference);
  });
  invalidateClinicDirectory();
}

export const firebaseAccessReviewStore: AccessReviewStore = {
  readClinic: async (clinicId) => {
    const clinic = await readClinic(clinicId);
    return clinic ? { ...clinic, approval_status: clinic.approval_status } : null;
  },
  hasVerifiedIdentity,
  approve,
  deleteSelfRegistered,
};
