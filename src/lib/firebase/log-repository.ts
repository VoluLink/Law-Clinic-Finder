import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { LogRepository, NewStoredLog, StoredLog } from '@/lib/logs/log-store';

import { firebaseFirestore } from './admin';
import { firestoreDateSchema } from './documents';

const DELETE_BATCH_SIZE = 400;

const logDocumentSchema = z
  .object({
    loggedAt: firestoreDateSchema,
    level: z.enum(['debug', 'info', 'warn', 'error']),
    msg: z.string().min(1).max(1000),
    fields: z.record(z.string(), z.json()).nullable(),
    expiresAt: firestoreDateSchema,
  })
  .strict();

function toStoredLog(id: string, data: unknown): StoredLog {
  const parsed = logDocumentSchema.parse(data);
  return {
    id,
    logged_at: parsed.loggedAt.toISOString(),
    level: parsed.level,
    msg: parsed.msg,
    fields: parsed.fields,
  };
}

async function write(log: NewStoredLog): Promise<void> {
  await firebaseFirestore()
    .collection('logs')
    .add({
      loggedAt: Timestamp.fromDate(new Date(log.logged_at)),
      level: log.level,
      msg: log.msg,
      fields: log.fields,
      expiresAt: Timestamp.fromDate(new Date(log.expires_at)),
    });
}

async function list(limit: number): Promise<StoredLog[]> {
  const safeLimit = z.number().int().min(1).max(500).parse(limit);
  const snapshot = await firebaseFirestore()
    .collection('logs')
    .orderBy('loggedAt', 'desc')
    .limit(safeLimit)
    .get();
  return snapshot.docs.map((document) => toStoredLog(document.id, document.data()));
}

async function deleteBatch(): Promise<number> {
  const snapshot = await firebaseFirestore().collection('logs').limit(DELETE_BATCH_SIZE).get();
  if (snapshot.empty) return 0;
  const batch = firebaseFirestore().batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.size;
}

async function clear(): Promise<void> {
  while ((await deleteBatch()) === DELETE_BATCH_SIZE) continue;
}

export const firebaseLogRepository: LogRepository = { write, list, clear };
