import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { LogPage, LogRepository, NewStoredLog, StoredLog } from '@/lib/logs/log-store';

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

/*
 * A single unreadable row must not blank the whole Protokolle view. `parse` threw
 * out of `list()` and the admin saw an empty table while stdout showed healthy
 * logs, so one legacy or oversized document hid every other entry. Unreadable
 * rows are skipped and counted instead.
 */
function toStoredLog(id: string, data: unknown): StoredLog | null {
  const parsed = logDocumentSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    id,
    logged_at: parsed.data.loggedAt.toISOString(),
    level: parsed.data.level,
    msg: parsed.data.msg,
    fields: parsed.data.fields,
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
  return (await listPage(limit)).logs;
}

async function listPage(limit: number, before?: Date): Promise<LogPage> {
  const safeLimit = z.number().int().min(1).max(500).parse(limit);
  const base = firebaseFirestore().collection('logs').orderBy('loggedAt', 'desc');
  const query = before ? base.startAfter(Timestamp.fromDate(before)) : base;
  const snapshot = await query.limit(safeLimit).get();
  const logs = snapshot.docs.flatMap((document) => {
    const parsed = toStoredLog(document.id, document.data());
    return parsed ? [parsed] : [];
  });
  // The cursor tracks the last *fetched* row, not the last readable one — taking
  // it from `logs` would re-fetch any unreadable tail forever.
  const lastFetched = snapshot.docs.at(-1);
  return {
    logs,
    unreadable: snapshot.size - logs.length,
    cursor: lastFetched ? cursorOf(lastFetched) : null,
    exhausted: snapshot.size < safeLimit,
  };
}

function cursorOf(document: FirebaseFirestore.QueryDocumentSnapshot): string | null {
  const loggedAt = firestoreDateSchema.safeParse(document.get('loggedAt'));
  return loggedAt.success ? loggedAt.data.toISOString() : null;
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

export const firebaseLogRepository: LogRepository = { write, list, listPage, clear };
