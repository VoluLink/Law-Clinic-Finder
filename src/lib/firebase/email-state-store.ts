import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { EmailStateRecord, EmailStateStore } from '@/lib/auth/email-state';

import { firebaseFirestore } from './admin';

const timestampSchema = z.instanceof(Timestamp).transform((timestamp) => timestamp.toDate());

const recordSchema = z.object({
  email: z.email(),
  userId: z.string().min(1),
  purpose: z.enum(['login', 'invite', 'email_change']),
  codeHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});

export function createFirestoreEmailStateStore(database = firebaseFirestore()): EmailStateStore {
  const collection = database.collection('authEmailStates');
  return {
    async save(id, record) {
      await collection.doc(id).set(encode(record));
    },
    async find(id) {
      return decode((await collection.doc(id).get()).data());
    },
    async consume(id, codeHash, now) {
      return database.runTransaction(async (transaction) => {
        const reference = collection.doc(id);
        const record = decode((await transaction.get(reference)).data());
        if (!record || record.codeHash !== codeHash || record.expiresAt <= now) return null;
        transaction.delete(reference);
        return record;
      });
    },
    async delete(id) {
      await collection.doc(id).delete();
    },
  };
}

function encode(record: EmailStateRecord) {
  return {
    ...record,
    createdAt: Timestamp.fromDate(record.createdAt),
    expiresAt: Timestamp.fromDate(record.expiresAt),
  };
}

function decode(value: unknown): EmailStateRecord | null {
  const parsed = recordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
