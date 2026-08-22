import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { DevAccount, DevLoginStore, DevRole } from '@/lib/dev/dev-login';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { clinicDocumentSchema, profileDocumentSchema } from './documents';
import { emailReservationReferences } from './identity-reservations';
import { firebaseConfig } from './env';

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function findOrCreateUser(email: string): Promise<string> {
  try {
    return (await firebaseAdminAuth().createUser({ email, emailVerified: true })).uid;
  } catch (error) {
    if (errorCode(error) !== 'auth/email-already-exists') throw error;
    return (await firebaseAdminAuth().getUserByEmail(email)).uid;
  }
}

async function resolveClinicId(name: string): Promise<string> {
  const snapshot = await firebaseFirestore()
    .collection('clinics')
    .where('name', '==', name)
    .limit(2)
    .get();
  if (snapshot.size !== 1) {
    throw new Error(`expected exactly one clinic named "${name}"`);
  }
  clinicDocumentSchema.parse(snapshot.docs[0].data());
  return snapshot.docs[0].id;
}

async function ensureIdentity(role: DevRole, account: DevAccount) {
  const userId = await findOrCreateUser(account.email);
  const clinicId = account.clinicName ? await resolveClinicId(account.clinicName) : null;
  await firebaseAdminAuth().setCustomUserClaims(userId, {
    role,
    accessStatus: 'active',
    ...(clinicId ? { clinicId } : {}),
  });
  if (role === 'admin') {
    await linkAdmin(userId, account.email);
  } else if (clinicId) {
    await linkClinic(userId, account.email, clinicId);
  }
  return { userId, clinicId };
}

async function linkAdmin(userId: string, email: string): Promise<void> {
  const database = firebaseFirestore();
  const profileReference = database.doc(`profiles/${userId}`);
  const stateReference = database.doc('adminState/current');
  const emailReferences = emailReservationReferences(database, email);
  await database.runTransaction(async (transaction) => {
    const [profile, state, owner, pending] = await Promise.all([
      transaction.get(profileReference),
      transaction.get(stateReference),
      transaction.get(emailReferences.active),
      transaction.get(emailReferences.pending),
    ]);
    if (owner.exists && owner.data()?.userId !== userId) throw new Error('dev email is reserved');
    if (pending.exists) throw new Error('dev email has a pending reservation');
    if (profile.exists && profileDocumentSchema.parse(profile.data()).role !== 'admin') {
      throw new Error('dev profile role mismatch');
    }
    const count = state.exists ? z.number().int().positive().parse(state.data()?.count) : 0;
    writeDevProfile(transaction, profileReference, 'admin', null, profile.data());
    transaction.set(emailReferences.active, { userId, role: 'admin', updatedAt: Timestamp.now() });
    transaction.set(stateReference, {
      count: profile.exists ? count : count + 1,
      updatedAt: Timestamp.now(),
    });
  });
}

async function linkClinic(userId: string, email: string, clinicId: string): Promise<void> {
  const database = firebaseFirestore();
  const profileReference = database.doc(`profiles/${userId}`);
  const clinicOwner = database.doc(`uniqueClinicOwners/${clinicId}`);
  const emailReferences = emailReservationReferences(database, email);
  await database.runTransaction(async (transaction) => {
    const [profile, owner, emailOwner, pending] = await Promise.all([
      transaction.get(profileReference),
      transaction.get(clinicOwner),
      transaction.get(emailReferences.active),
      transaction.get(emailReferences.pending),
    ]);
    if (owner.exists && owner.data()?.userId !== userId) throw new Error('clinic is reserved');
    if (emailOwner.exists && emailOwner.data()?.userId !== userId) {
      throw new Error('dev email is reserved');
    }
    if (pending.exists) throw new Error('dev email has a pending reservation');
    writeDevProfile(transaction, profileReference, 'clinic', clinicId, profile.data());
    transaction.set(clinicOwner, { userId, updatedAt: Timestamp.now() });
    transaction.set(emailReferences.active, { userId, role: 'clinic', updatedAt: Timestamp.now() });
  });
}

function writeDevProfile(
  transaction: FirebaseFirestore.Transaction,
  reference: FirebaseFirestore.DocumentReference,
  role: DevRole,
  clinicId: string | null,
  current: unknown,
): void {
  const parsed = profileDocumentSchema.safeParse(current);
  const now = Timestamp.now();
  transaction.set(reference, {
    role,
    clinicId,
    accessStatus: 'active',
    activatedAt: parsed.success ? parsed.data.activatedAt : null,
    createdAt: parsed.success ? parsed.data.createdAt : now,
    updatedAt: now,
  });
}

async function generateActionCode(email: string): Promise<string> {
  const settings = {
    url: `${firebaseConfig().siteUrl}/auth/confirm`,
    handleCodeInApp: true,
  } as const;
  const link = await firebaseAdminAuth().generateSignInWithEmailLink(email, settings);
  const url = new URL(link);
  const parsed = z.string().min(10).max(2_000).safeParse(url.searchParams.get('oobCode'));
  if (!parsed.success || url.searchParams.get('mode') !== 'signIn') {
    throw new Error('Firebase returned an invalid dev sign-in link');
  }
  return parsed.data;
}

export const firebaseDevLoginStore: DevLoginStore = { ensureIdentity, generateActionCode };
