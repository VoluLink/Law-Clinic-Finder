import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { ClinicClaimStore } from '@/lib/signup/handle-claim';
import { claimAttemptExpiry, reserveClaimAttempt } from '@/lib/signup/claim-window';
import { maskEmail } from '@/lib/signup/mask-email';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';
import { readClinic } from './clinic-repository';
import { isEmailReserved } from './identity-reservations';

const claimLimitSchema = z
  .object({
    attempts: firestoreDateSchema.array().max(2),
    expiresAt: firestoreDateSchema,
  })
  .strict();

async function readMatch(clinicIdInput: string) {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const database = firebaseFirestore();
  const [clinic, owner] = await Promise.all([
    readClinic(clinicId),
    database.collection('uniqueClinicOwners').doc(clinicId).get(),
  ]);
  if (!clinic || clinic.approval_status !== 'approved') return null;
  return {
    id: clinicId,
    name: clinic.name,
    region: clinic.region,
    claimed: owner.exists,
    hasContactEmail: Boolean(clinic.contact_email),
    maskedEmail: clinic.contact_email ? maskEmail(clinic.contact_email) : null,
  };
}

async function isEmailTaken(emailInput: string): Promise<boolean> {
  const email = z.string().trim().email().parse(emailInput).toLowerCase();
  const database = firebaseFirestore();
  return isEmailReserved(database, email);
}

async function reserveAttempt(clinicIdInput: string, nowInput: Date) {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const now = z.date().parse(nowInput);
  const database = firebaseFirestore();
  const reference = database.collection('claimLimits').doc(clinicId);
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const attempts = snapshot.exists ? claimLimitSchema.parse(snapshot.data()).attempts : [];
    const result = reserveClaimAttempt(attempts, now);
    if (result.allowed) {
      transaction.set(reference, claimLimitRecord(result.attempts, now));
    }
    return result.allowed ? { allowed: true as const } : result;
  });
}

function claimLimitRecord(attempts: Date[], now: Date) {
  return {
    attempts: attempts.map((attempt) => Timestamp.fromDate(attempt)),
    expiresAt: Timestamp.fromDate(claimAttemptExpiry(now)),
  };
}

export const firebaseClinicClaimStore: ClinicClaimStore = {
  readMatch,
  isEmailTaken,
  reserveAttempt,
};
