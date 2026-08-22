import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type {
  AdminAccount,
  AdminAccountStore,
  AdminInviteResult,
  AdminRemovalResult,
} from '@/lib/admin/manage-admins';
import { sendSignInLink } from '@/lib/auth/email-link';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { profileDocumentSchema } from './documents';
import {
  emailReservationReferences,
  firebaseUidSchema,
  isEmailReserved,
} from './identity-reservations';

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .transform((email) => email.toLowerCase());
const stateSchema = z.object({ count: z.number().int().positive() });

class EmailTakenError extends Error {}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function list(): Promise<AdminAccount[]> {
  const profiles = await firebaseFirestore()
    .collection('profiles')
    .where('role', '==', 'admin')
    .get();
  const accounts = await Promise.all(
    profiles.docs.map(async (document) => {
      const profile = profileDocumentSchema.parse(document.data());
      const user = await firebaseAdminAuth().getUser(document.id);
      if (!user.email) throw new Error('admin identity has no email');
      return {
        userId: user.uid,
        email: user.email,
        status: user.metadata.lastSignInTime ? ('active' as const) : ('invited' as const),
        createdAt: profile.createdAt.toISOString(),
      };
    }),
  );
  return accounts.sort((left, right) => left.email.localeCompare(right.email, 'de'));
}

async function createAdminIdentity(email: string): Promise<string | null> {
  try {
    return (await firebaseAdminAuth().createUser({ email, emailVerified: false })).uid;
  } catch (error) {
    if (errorCode(error) === 'auth/email-already-exists') return null;
    throw error;
  }
}

async function linkAdmin(userId: string, email: string): Promise<void> {
  const database = firebaseFirestore();
  const emailReferences = emailReservationReferences(database, email);
  const stateReference = database.collection('adminState').doc('current');
  await database.runTransaction(async (transaction) => {
    const [emailOwner, pendingEmailOwner, state] = await Promise.all([
      transaction.get(emailReferences.active),
      transaction.get(emailReferences.pending),
      transaction.get(stateReference),
    ]);
    if (emailOwner.exists || pendingEmailOwner.exists) throw new EmailTakenError();
    const count = state.exists ? stateSchema.parse(state.data()).count : 0;
    const now = Timestamp.now();
    transaction.create(emailReferences.active, { userId, role: 'admin', updatedAt: now });
    transaction.create(database.collection('profiles').doc(userId), {
      role: 'admin',
      clinicId: null,
      accessStatus: 'active',
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(stateReference, { count: count + 1, updatedAt: now });
  });
}

async function invite(emailInput: string): Promise<AdminInviteResult> {
  const email = emailSchema.parse(emailInput);
  const database = firebaseFirestore();
  if (await isEmailReserved(database, email)) {
    return { status: 'email_taken' };
  }
  const userId = await createAdminIdentity(email);
  if (!userId) return { status: 'email_taken' };
  try {
    await firebaseAdminAuth().setCustomUserClaims(userId, {
      role: 'admin',
      accessStatus: 'active',
    });
    await linkAdmin(userId, email);
  } catch (error) {
    await firebaseAdminAuth().deleteUser(userId);
    if (error instanceof EmailTakenError) return { status: 'email_taken' };
    throw error;
  }
  try {
    await sendSignInLink({ email, userId, purpose: 'invite' });
    return { status: 'ok' };
  } catch {
    return { status: 'invite_failed' };
  }
}

async function reservedEmailReference(userId: string) {
  const snapshot = await firebaseFirestore()
    .collection('emailOwners')
    .where('userId', '==', userId)
    .limit(2)
    .get();
  if (snapshot.size > 1) throw new Error('identity has multiple email reservations');
  return snapshot.docs[0]?.ref ?? null;
}

async function removeProfile(userId: string): Promise<AdminRemovalResult> {
  const database = firebaseFirestore();
  const profileReference = database.collection('profiles').doc(userId);
  const stateReference = database.collection('adminState').doc('current');
  const jobReference = database.collection('identityDeletionJobs').doc(userId);
  const emailReference = await reservedEmailReference(userId);
  return database.runTransaction(async (transaction) => {
    const reads = [transaction.get(profileReference), transaction.get(stateReference)];
    if (emailReference) reads.push(transaction.get(emailReference));
    const [profileSnapshot, stateSnapshot, emailSnapshot] = await Promise.all(reads);
    if (!profileSnapshot.exists) return { status: 'not_found' as const };
    const profile = profileDocumentSchema.parse(profileSnapshot.data());
    if (profile.role !== 'admin') return { status: 'not_found' as const };
    const state = stateSchema.parse(stateSnapshot.data());
    if (state.count <= 1) return { status: 'last_admin' as const };
    transaction.delete(profileReference);
    if (emailReference && emailSnapshot?.data()?.userId === userId)
      transaction.delete(emailReference);
    transaction.set(stateReference, { count: state.count - 1, updatedAt: Timestamp.now() });
    transaction.set(jobReference, { createdAt: Timestamp.now() });
    return { status: 'ok' as const };
  });
}

async function deleteIdentity(userId: string): Promise<void> {
  try {
    await firebaseAdminAuth().deleteUser(userId);
  } catch (error) {
    if (errorCode(error) !== 'auth/user-not-found') throw error;
  }
  await firebaseFirestore().collection('identityDeletionJobs').doc(userId).delete();
}

async function remove(userIdInput: string, actingUserIdInput: string): Promise<AdminRemovalResult> {
  const userId = firebaseUidSchema.parse(userIdInput);
  const actingUserId = firebaseUidSchema.parse(actingUserIdInput);
  if (userId === actingUserId) return { status: 'self' };
  const job = await firebaseFirestore().collection('identityDeletionJobs').doc(userId).get();
  if (job.exists) {
    await deleteIdentity(userId);
    return { status: 'ok' };
  }
  const result = await removeProfile(userId);
  if (result.status !== 'ok') return result;
  await deleteIdentity(userId);
  return { status: 'ok' };
}

export const firebaseAdminAccountStore: AdminAccountStore = { list, invite, remove };
