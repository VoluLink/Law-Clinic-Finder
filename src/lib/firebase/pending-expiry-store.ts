import 'server-only';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { decideExpiry, type PendingApplication } from '@/lib/signup/pending-expiry';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import { clinicNameReservationId } from './clinic-repository';
import { clinicDocumentSchema, profileDocumentSchema } from './documents';
import {
  emailReservationHolder,
  emailReservationId,
  isEmailReserved,
} from './identity-reservations';
import { invalidateSignupDirectory } from './signup-directory';

/**
 * Releases the reservations an unanswered registration or claim is holding.
 *
 * Every deletion happens inside one transaction that re-reads its own
 * preconditions, so an application approved or answered a moment earlier is
 * left alone rather than half-deleted. The Auth user goes last and only if the
 * transaction actually released the reservations — the reverse order would
 * delete a real account whenever the transaction turned out to be a no-op.
 */

export type ExpiryOutcome = 'expired' | 'kept' | 'missing';

/** How many due applications a single signup request is willing to clean up. */
export const SWEEP_BATCH_LIMIT = 5;

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

type AuthState = { emailVerified: boolean; lastSignInAt: Date | null; email: string | null };

/** A profile whose Auth user is already gone is an orphan, and expirable. */
const ORPHANED: AuthState = { emailVerified: false, lastSignInAt: null, email: null };

/**
 * Real Firebase leaves `lastSignInTime` unset until someone actually signs in;
 * the Auth emulator stamps it at creation. Reading "same instant as creation" as
 * never-signed-in makes the rule behave identically in both, so the emulator
 * test exercises the production path rather than a stubbed one. The invite has
 * to be delivered and clicked, so a genuine sign-in in the creating second is
 * not a case that occurs.
 */
function lastSignIn(metadata: { creationTime: string; lastSignInTime: string }): Date | null {
  if (!metadata.lastSignInTime || metadata.lastSignInTime === metadata.creationTime) return null;
  const signedIn = new Date(metadata.lastSignInTime);
  return Number.isNaN(signedIn.valueOf()) ? null : signedIn;
}

async function authState(userId: string): Promise<AuthState> {
  try {
    const user = await firebaseAdminAuth().getUser(userId);
    return {
      emailVerified: user.emailVerified,
      lastSignInAt: lastSignIn(user.metadata),
      email: user.email?.toLowerCase() ?? null,
    };
  } catch (error) {
    if (errorCode(error) === 'auth/user-not-found') return ORPHANED;
    throw error;
  }
}

async function readApplication(userId: string, database: FirebaseFirestore.Firestore) {
  const profileSnapshot = await database.collection('profiles').doc(userId).get();
  if (!profileSnapshot.exists) return null;
  const profile = profileDocumentSchema.parse(profileSnapshot.data());
  if (profile.role !== 'clinic' || !profile.clinicId) return null;
  const clinicSnapshot = await database.collection('clinics').doc(profile.clinicId).get();
  if (!clinicSnapshot.exists) return null;
  const clinic = clinicDocumentSchema.parse(clinicSnapshot.data());
  const auth = await authState(userId);
  const application: PendingApplication = {
    clinicId: profile.clinicId,
    userId,
    accessStatus: profile.accessStatus,
    approvalStatus: clinic.approvalStatus,
    expiresAt: profile.expiresAt ?? null,
    emailVerified: auth.emailVerified,
    lastSignInAt: auth.lastSignInAt,
  };
  return { application, clinicName: clinic.name, email: auth.email };
}

type ReleaseInput = {
  userId: string;
  clinicId: string;
  clinicName: string;
  email: string | null;
  removeClinic: boolean;
  now: Date;
};

/**
 * Re-reads every precondition. `accessStatus` moves to 'active' on approval and
 * `expiresAt` is cleared the moment the applicant answers the invite, so both
 * races end here with a `false` rather than with a deleted account.
 */
async function release(input: ReleaseInput): Promise<boolean> {
  const database = firebaseFirestore();
  const profileReference = database.collection('profiles').doc(input.userId);
  const ownerReference = database.collection('uniqueClinicOwners').doc(input.clinicId);
  const emailReference = input.email
    ? database.collection('emailOwners').doc(emailReservationId(input.email))
    : null;
  const nameReference = database
    .collection('uniqueClinicNames')
    .doc(clinicNameReservationId(input.clinicName));
  return database.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileReference);
    if (!stillDue(profileSnapshot, input.now)) return false;
    const [owner, emailOwner, name] = await Promise.all([
      transaction.get(ownerReference),
      emailReference ? transaction.get(emailReference) : Promise.resolve(null),
      input.removeClinic ? transaction.get(nameReference) : Promise.resolve(null),
    ]);
    transaction.delete(profileReference);
    if (owner.data()?.userId === input.userId) transaction.delete(ownerReference);
    if (emailReference && emailOwner?.data()?.userId === input.userId) {
      transaction.delete(emailReference);
    }
    if (input.removeClinic) {
      if (name?.data()?.clinicId === input.clinicId) transaction.delete(nameReference);
      transaction.delete(database.collection('clinicContacts').doc(input.clinicId));
      transaction.delete(database.collection('clinics').doc(input.clinicId));
    }
    return true;
  });
}

function stillDue(snapshot: FirebaseFirestore.DocumentSnapshot, now: Date): boolean {
  if (!snapshot.exists) return false;
  const profile = profileDocumentSchema.safeParse(snapshot.data());
  if (!profile.success || profile.data.accessStatus !== 'pending') return false;
  const expiresAt = profile.data.expiresAt ?? null;
  return expiresAt !== null && expiresAt <= now;
}

/**
 * Only after the reservations are gone, and only if the applicant still has not
 * answered. A sign-in between the transaction and this call leaves the account
 * in place with no profile: recoverable by a fresh invite, unlike a deletion.
 */
async function removeIdentity(userId: string): Promise<void> {
  const auth = await authState(userId);
  if (auth.emailVerified || auth.lastSignInAt !== null) {
    logger.warn('pending application answered while it was being expired', { userId });
    return;
  }
  try {
    await firebaseAdminAuth().deleteUser(userId);
  } catch (error) {
    if (errorCode(error) !== 'auth/user-not-found') throw error;
  }
}

export async function expirePendingApplication(
  userId: string,
  now = new Date(),
): Promise<ExpiryOutcome> {
  const database = firebaseFirestore();
  const found = await readApplication(userId, database);
  if (!found) return 'missing';
  const decision = decideExpiry(found.application, now);
  if (decision.action === 'keep') return 'kept';
  const released = await release({
    userId,
    clinicId: found.application.clinicId,
    clinicName: found.clinicName,
    email: found.email,
    removeClinic: decision.removeClinic,
    now,
  });
  if (!released) return 'kept';
  await removeIdentity(userId);
  if (decision.removeClinic) invalidateSignupDirectory();
  invalidateClinicDirectory();
  logger.info('expired an unanswered clinic application', {
    clinicId: found.application.clinicId,
    removedClinic: decision.removeClinic,
  });
  return 'expired';
}

/**
 * Runs on the signup requests that would otherwise collide with a stale
 * reservation, which is the moment releasing one actually helps someone. There
 * is no scheduled sweep: the query is indexed and bounded, and a site nobody is
 * registering with has nothing to unblock.
 */
export async function sweepDueApplications(now = new Date()): Promise<number> {
  const snapshot = await firebaseFirestore()
    .collection('profiles')
    .where('accessStatus', '==', 'pending')
    .where('expiresAt', '<=', now)
    .limit(SWEEP_BATCH_LIMIT)
    .get();
  const outcomes = await Promise.all(
    snapshot.docs.map((document) => expirePendingApplication(document.id, now)),
  );
  return outcomes.filter((outcome) => outcome === 'expired').length;
}

/** Named for the caller: a collision is only real once the stale holder is gone. */
export async function releaseExpiredHolder(
  clinicId: string,
  now = new Date(),
): Promise<ExpiryOutcome> {
  const id = z.string().uuid().parse(clinicId);
  const snapshot = await firebaseFirestore()
    .collection('profiles')
    .where('clinicId', '==', id)
    .limit(2)
    .get();
  if (snapshot.size !== 1) return 'missing';
  return expirePendingApplication(snapshot.docs[0].id, now);
}

/**
 * A reservation held by an application nobody ever answered is not a real
 * collision, so the signup paths ask this rather than reading the reservation
 * directly. It costs one extra read only when there is already a conflict.
 */
export async function emailReservationIsLive(email: string, now = new Date()): Promise<boolean> {
  const database = firebaseFirestore();
  if (!(await isEmailReserved(database, email))) return false;
  const holder = await emailReservationHolder(database, email);
  if (holder) await expirePendingApplication(holder, now);
  return isEmailReserved(database, email);
}
