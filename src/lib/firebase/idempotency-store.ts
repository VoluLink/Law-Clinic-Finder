import { createHash } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { IdempotencyRecord, IdempotencyStore } from '@/lib/http/idempotency';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';

const COLLECTION = 'idempotencyKeys';

const recordSchema = z
  .object({
    status: z.enum(['in_progress', 'completed']),
    result: z.json().nullable(),
    createdAt: firestoreDateSchema,
    expiresAt: firestoreDateSchema,
  })
  .strict();

/** Hashing keeps a client-supplied key out of the document id and bounds it. */
function documentId(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function reference(key: string) {
  return firebaseFirestore().collection(COLLECTION).doc(documentId(key));
}

/** gRPC ALREADY_EXISTS — the only outcome that means another request won. */
const ALREADY_EXISTS = 6;

function isAlreadyExists(error: unknown): boolean {
  return (error as { code?: unknown })?.code === ALREADY_EXISTS;
}

/**
 * `create()` is rejected by the server when the document exists, so two
 * concurrent retries can never both believe they claimed the key. A transaction
 * would not do: reading a missing document does not serialize against a
 * competing write.
 */
async function claim(key: string, expiresAt: Date): Promise<IdempotencyRecord | null> {
  const document = reference(key);
  try {
    await document.create(claimData(expiresAt));
    return null;
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    return reclaimIfStale(key, expiresAt);
  }
}

function claimData(expiresAt: Date) {
  return {
    status: 'in_progress' as const,
    result: null,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
  };
}

/** An expired or unreadable claim is taken over inside a transaction, which is
 *  safe here because the contested document exists. */
async function reclaimIfStale(key: string, expiresAt: Date): Promise<IdempotencyRecord | null> {
  const document = reference(key);
  return firebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    const stored = snapshot.exists ? recordSchema.safeParse(snapshot.data()) : null;
    if (stored?.success && stored.data.expiresAt > new Date()) {
      return { status: stored.data.status, result: stored.data.result };
    }
    transaction.set(document, claimData(expiresAt));
    return null;
  });
}

async function complete(key: string, result: unknown): Promise<void> {
  await reference(key).update({ status: 'completed', result: z.json().parse(result) });
}

async function release(key: string): Promise<void> {
  await reference(key).delete();
}

export const firebaseIdempotencyStore: IdempotencyStore = { claim, complete, release };
