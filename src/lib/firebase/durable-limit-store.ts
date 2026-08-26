import 'server-only';

import { createHash } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import {
  recordAttempt,
  windowExpiry,
  type AbuseWindow,
  type WindowDecision,
} from '@/lib/security/abuse-window';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';

/**
 * Durable counterpart to the in-process rate limiter, for the few actions where
 * a per-instance count is not a limit at all: sending login mail, and reserving
 * a clinic name or an e-mail address. Autoscaling and cold starts reset the Map
 * in `src/lib/rate-limit.ts`; this survives both.
 *
 * The subject never reaches Firestore. Only a scope-separated SHA-256 of it
 * becomes the document id, which is the same treatment `emailOwners` already
 * gives an address, and the document holds nothing but timestamps.
 */

export type LimitScope = 'login' | 'application' | 'network';

const COLLECTION = 'abuseLimits';

const limitDocumentSchema = z
  .object({
    hits: firestoreDateSchema.array().max(64),
    expiresAt: firestoreDateSchema,
  })
  .strict();

/** Scope-separated so the same address counts independently per action. */
function limitId(scope: LimitScope, subject: string): string {
  return createHash('sha256').update(`${scope}:${subject.trim().toLowerCase()}`).digest('hex');
}

function storedHits(data: FirebaseFirestore.DocumentData | undefined): Date[] {
  const parsed = limitDocumentSchema.safeParse(data);
  return parsed.success ? parsed.data.hits : [];
}

/**
 * One transaction per subject, so two instances racing the same last remaining
 * attempt cannot both win. A blocked attempt writes nothing at all, which keeps
 * a flood from turning into a write amplifier.
 */
export async function consumeDurableLimit(
  scope: LimitScope,
  subject: string,
  window: AbuseWindow,
  now = new Date(),
): Promise<WindowDecision> {
  const database = firebaseFirestore();
  const reference = database.collection(COLLECTION).doc(limitId(scope, subject));
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const decision = recordAttempt(storedHits(snapshot.data()), window, now);
    if (!decision.allowed) return decision;
    transaction.set(reference, {
      hits: decision.hits.map((hit) => Timestamp.fromDate(hit)),
      expiresAt: Timestamp.fromDate(windowExpiry(decision.hits, window)),
    });
    return decision;
  });
}

/**
 * Every key must be allowed. The keys are consumed in order and the first
 * refusal stops the rest, so a blocked subject costs one transaction rather
 * than one per dimension.
 */
export async function consumeDurableLimits(
  keys: readonly { scope: LimitScope; subject: string; window: AbuseWindow }[],
  now = new Date(),
): Promise<WindowDecision> {
  let allowed: WindowDecision = { allowed: true, hits: [now] };
  for (const key of keys) {
    const decision = await consumeDurableLimit(key.scope, key.subject, key.window, now);
    if (!decision.allowed) return decision;
    allowed = decision;
  }
  return allowed;
}
