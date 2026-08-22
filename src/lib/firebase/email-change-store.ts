import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { EmailChangeRequestDependencies } from '@/lib/auth/email-change';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';
import {
  emailReservationId,
  emailReservationReferences,
  firebaseUidSchema,
} from './identity-reservations';

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .transform((email) => email.toLowerCase());
const ownerSchema = z
  .object({ userId: firebaseUidSchema, role: z.enum(['admin', 'clinic']) })
  .passthrough();
const pendingSchema = z.object({
  userId: firebaseUidSchema,
  oldEmailHash: z.string().regex(/^[0-9a-f]{64}$/),
  role: z.enum(['admin', 'clinic']),
  expiresAt: firestoreDateSchema,
});
const operationalSettingsSchema = z
  .object({ selectedAdminUserId: firebaseUidSchema })
  .passthrough();

export function isSelectedOperationalRecipient(value: unknown, userId: string): boolean {
  const settings = operationalSettingsSchema.safeParse(value);
  return settings.success && settings.data.selectedAdminUserId === userId;
}

async function reserve(
  userIdInput: string,
  currentEmailInput: string,
  newEmailInput: string,
  expiresAtInput: Date,
) {
  const userId = firebaseUidSchema.parse(userIdInput);
  const currentEmail = emailSchema.parse(currentEmailInput);
  const newEmail = emailSchema.parse(newEmailInput);
  const expiresAt = z.date().parse(expiresAtInput);
  const database = firebaseFirestore();
  return database.runTransaction(async (transaction) => {
    const current = emailReservationReferences(database, currentEmail);
    const target = emailReservationReferences(database, newEmail);
    const userPending = database.collection('pendingEmailOwners').where('userId', '==', userId);
    const [owner, targetOwner, targetPending, pending] = await Promise.all([
      transaction.get(current.active),
      transaction.get(target.active),
      transaction.get(target.pending),
      transaction.get(userPending),
    ]);
    const currentOwner = ownerSchema.safeParse(owner.data());
    if (!currentOwner.success || currentOwner.data.userId !== userId) {
      throw new Error('current email reservation mismatch');
    }
    if (targetOwner.exists || targetPending.exists || !pending.empty) return 'email_taken' as const;
    transaction.create(target.pending, {
      userId,
      oldEmailHash: emailReservationId(currentEmail),
      role: currentOwner.data.role,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
    });
    return 'ok' as const;
  });
}

async function release(userIdInput: string, newEmailInput: string): Promise<void> {
  const userId = firebaseUidSchema.parse(userIdInput);
  const newEmail = emailSchema.parse(newEmailInput);
  const reference = emailReservationReferences(firebaseFirestore(), newEmail).pending;
  await firebaseFirestore().runTransaction(async (transaction) => {
    const pending = pendingSchema.safeParse((await transaction.get(reference)).data());
    if (pending.success && pending.data.userId === userId) transaction.delete(reference);
  });
}

export async function finalizeEmailChange(
  userIdInput: string,
  newEmailInput: string,
): Promise<void> {
  const userId = firebaseUidSchema.parse(userIdInput);
  const newEmail = emailSchema.parse(newEmailInput);
  const database = firebaseFirestore();
  const target = emailReservationReferences(database, newEmail);
  const operationsReference = database.collection('settings').doc('operations');
  await database.runTransaction(async (transaction) => {
    const [pendingSnapshot, targetOwner, operations] = await Promise.all([
      transaction.get(target.pending),
      transaction.get(target.active),
      transaction.get(operationsReference),
    ]);
    if (!pendingSnapshot.exists) return acceptCompletedReservation(targetOwner.data(), userId);
    const pending = pendingSchema.parse(pendingSnapshot.data());
    if (pending.userId !== userId) throw new Error('pending email owner mismatch');
    const currentReference = database.collection('emailOwners').doc(pending.oldEmailHash);
    const currentOwner = ownerSchema.parse((await transaction.get(currentReference)).data());
    if (currentOwner.userId !== userId) throw new Error('current email owner mismatch');
    if (targetOwner.exists && targetOwner.data()?.userId !== userId) {
      throw new Error('new email owner mismatch');
    }
    transaction.set(target.active, { userId, role: pending.role, updatedAt: Timestamp.now() });
    transaction.delete(currentReference);
    transaction.delete(target.pending);
    if (isSelectedOperationalRecipient(operations.data(), userId)) {
      transaction.set(operationsReference, { updatedAt: Timestamp.now() }, { merge: true });
    }
  });
}

function acceptCompletedReservation(value: unknown, userId: string): void {
  const owner = ownerSchema.safeParse(value);
  if (!owner.success || owner.data.userId !== userId) {
    throw new Error('pending email reservation is missing');
  }
}

export async function readFirebaseAuthEmail(userIdInput: string): Promise<string | null> {
  const user = await firebaseAdminAuth().getUser(firebaseUidSchema.parse(userIdInput));
  return user.email?.toLowerCase() ?? null;
}

export const firebaseEmailChangeStore: Pick<EmailChangeRequestDependencies, 'reserve' | 'release'> =
  { reserve, release };
