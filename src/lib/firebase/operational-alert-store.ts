import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { OperationalAlertStore } from '@/lib/admin/operational-alerts';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema, profileDocumentSchema } from './documents';
import type { ProfileDocument } from './documents';
import { firebaseUidSchema } from './identity-reservations';

const settingsSchema = z
  .object({ selectedAdminUserId: firebaseUidSchema, updatedAt: firestoreDateSchema })
  .strict();

export function isActiveOperationalAlertAdmin(
  profile: Pick<ProfileDocument, 'role' | 'accessStatus'>,
): boolean {
  return profile.role === 'admin' && profile.accessStatus === 'active';
}

async function readSelectedUserId(): Promise<string | null> {
  const snapshot = await firebaseFirestore().collection('settings').doc('operations').get();
  if (!snapshot.exists) return null;
  return settingsSchema.parse(snapshot.data()).selectedAdminUserId;
}

async function writeSelectedUserId(userIdInput: string): Promise<boolean> {
  const userId = firebaseUidSchema.parse(userIdInput);
  const database = firebaseFirestore();
  const profileReference = database.collection('profiles').doc(userId);
  const settingsReference = database.collection('settings').doc('operations');
  return database.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileReference);
    if (!profileSnapshot.exists) return false;
    const profile = profileDocumentSchema.parse(profileSnapshot.data());
    if (!isActiveOperationalAlertAdmin(profile)) return false;
    transaction.set(settingsReference, { selectedAdminUserId: userId, updatedAt: Timestamp.now() });
    return true;
  });
}

export const firebaseOperationalAlertStore: OperationalAlertStore = {
  readSelectedUserId,
  writeSelectedUserId,
};
