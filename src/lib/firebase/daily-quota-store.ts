import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import {
  applyQuotaClaim,
  quotaSessionSchema,
  quotaWindow,
  type DailyQuotaStore,
} from '@/lib/chat/daily-quota-store';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';

const deviceHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const sessionIdSchema = z.string().uuid();
const recordSchema = z
  .object({
    quotaDate: z.iso.date(),
    deviceHash: deviceHashSchema,
    sessions: quotaSessionSchema.array().max(2),
    expiresAt: firestoreDateSchema,
  })
  .strict();

async function claim(deviceHashInput: string, sessionIdInput: string, now: Date) {
  const deviceHash = deviceHashSchema.parse(deviceHashInput);
  const sessionId = sessionIdSchema.parse(sessionIdInput);
  const window = quotaWindow(now);
  const reference = firebaseFirestore()
    .collection('chatDailyQuotas')
    .doc(`${window.date}_${deviceHash}`);
  const allowed = await firebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.exists ? recordSchema.parse(snapshot.data()).sessions : [];
    const result = applyQuotaClaim(current, sessionId);
    if (result.allowed) {
      transaction.set(reference, {
        quotaDate: window.date,
        deviceHash,
        sessions: result.sessions,
        expiresAt: Timestamp.fromDate(new Date(window.resetAt)),
      });
    }
    return result.allowed;
  });
  return { allowed, resetAt: window.resetAt };
}

export const firebaseDailyQuotaStore: DailyQuotaStore = { claim };
