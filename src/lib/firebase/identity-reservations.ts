import { createHash } from 'node:crypto';

import { z } from 'zod';

export const firebaseUidSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export function emailReservationId(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export function emailReservationReferences(database: FirebaseFirestore.Firestore, email: string) {
  const id = emailReservationId(email);
  return {
    active: database.collection('emailOwners').doc(id),
    pending: database.collection('pendingEmailOwners').doc(id),
  };
}

export async function isEmailReserved(
  database: FirebaseFirestore.Firestore,
  email: string,
): Promise<boolean> {
  const references = emailReservationReferences(database, email);
  const [active, pending] = await Promise.all([references.active.get(), references.pending.get()]);
  return active.exists || pending.exists;
}
