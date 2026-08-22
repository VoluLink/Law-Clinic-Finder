import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { ClinicAccessStore, RevokeAccessOptions } from '@/lib/clinics/revoke-access';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { profileDocumentSchema } from './documents';
import { emailReservationId } from './identity-reservations';

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function linkedUser(
  clinicId: string,
): Promise<{ userId: string; email: string | null } | null> {
  const snapshot = await firebaseFirestore()
    .collection('profiles')
    .where('clinicId', '==', clinicId)
    .limit(2)
    .get();
  if (snapshot.size > 1) throw new Error('multiple profiles reference one clinic');
  const document = snapshot.docs[0];
  if (!document) return null;
  profileDocumentSchema.parse(document.data());
  try {
    const user = await firebaseAdminAuth().getUser(document.id);
    return { userId: document.id, email: user.email?.toLowerCase() ?? null };
  } catch (error) {
    if (errorCode(error) === 'auth/user-not-found') return { userId: document.id, email: null };
    throw error;
  }
}

async function deleteAuthUser(userId: string): Promise<void> {
  try {
    await firebaseAdminAuth().deleteUser(userId);
  } catch (error) {
    if (errorCode(error) !== 'auth/user-not-found') throw error;
  }
}

async function cleanupData(
  clinicId: string,
  user: { userId: string; email: string | null } | null,
  options: RevokeAccessOptions,
): Promise<void> {
  const database = firebaseFirestore();
  await database.runTransaction(async (transaction) => {
    const emailReference = user?.email
      ? database.collection('emailOwners').doc(emailReservationId(user.email))
      : null;
    const emailOwner = emailReference ? await transaction.get(emailReference) : null;
    if (user) transaction.delete(database.collection('profiles').doc(user.userId));
    transaction.delete(database.collection('uniqueClinicOwners').doc(clinicId));
    if (emailReference && emailOwner?.data()?.userId === user?.userId) {
      transaction.delete(emailReference);
    }
    const clinicPatch = {
      ...(options.unpublish ? { isPublished: false } : {}),
      updatedAt: Timestamp.now(),
    };
    transaction.update(database.collection('clinics').doc(clinicId), clinicPatch);
    if (options.clearContactEmail) {
      transaction.delete(database.collection('clinicContacts').doc(clinicId));
    }
  });
}

async function revoke(clinicIdInput: string, options: RevokeAccessOptions): Promise<void> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const user = await linkedUser(clinicId);
  if (user) await deleteAuthUser(user.userId);
  await cleanupData(clinicId, user, options);
  if (options.unpublish) invalidateClinicDirectory();
}

export const firebaseClinicAccessStore: ClinicAccessStore = { revoke };
