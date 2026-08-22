import { randomUUID } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { ConversationRecord, ConversationStore } from '@/lib/chat/persist-conversation';
import { chatMessageSchema } from '@/lib/chat/schema';
import { metricBucketId } from '@/lib/admin/metric-bucket';

import { firebaseFirestore } from './admin';
import { writeRecommendationEvents } from './clinic-events';
import { firestoreDateSchema } from './documents';

const TRANSCRIPT_CAP = 200;
const RETENTION_MS = 366 * 86_400_000;
/*
 * Message text expires far sooner than the statistics derived from it. Redaction
 * is deterministic and good, but it cannot guarantee that a legal narrative is
 * unidentifiable, so the readable transcript is the part worth keeping briefly.
 * Counts, costs and legal-area aggregates carry no narrative and keep the full
 * twelve-month window.
 */
const TRANSCRIPT_RETENTION_MS = 90 * 86_400_000;
const UNKNOWN_AREA = 'Unbekannt';

export const modelUsageSchema = z.record(
  z.string().min(1).max(100),
  z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
);

const recordSchema = z.object({
  sessionId: z.string().uuid().nullable(),
  redactedTranscript: chatMessageSchema.array().max(17).nullable(),
  redactionStatus: z.enum(['ok', 'failed']),
  detectedLegalArea: z.string().max(2000).nullable(),
  detectedCity: z.string().max(1000).nullable(),
  matchedClinicCount: z.number().int().nonnegative().nullable(),
  messageCount: z.number().int().nonnegative().max(17),
  model: z.string().min(1).max(100),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  recommendedClinicIds: z.string().uuid().array().max(8),
});

export const conversationSummarySchema = recordSchema.omit({ redactedTranscript: true }).extend({
  modelUsage: modelUsageSchema.default({}),
  hasTranscript: z.boolean(),
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
  expiresAt: firestoreDateSchema,
});

const retentionEntrySchema = z.object({
  id: z.string().uuid(),
  createdAtMs: z.number().int().nonnegative(),
});

const retentionSchema = z.object({
  entries: retentionEntrySchema.array().max(TRANSCRIPT_CAP),
  updatedAt: firestoreDateSchema,
});

export const conversationTranscriptSchema = z.object({
  messages: chatMessageSchema.array().max(17),
  updatedAt: firestoreDateSchema,
  expiresAt: firestoreDateSchema,
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
type RetentionEntry = z.infer<typeof retentionEntrySchema>;

function retentionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RETENTION_MS);
}

export function transcriptExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TRANSCRIPT_RETENTION_MS);
}

export function mergeConversation(
  current: ConversationSummary | null,
  input: ConversationRecord,
  now: Date,
): ConversationSummary {
  const parsed = recordSchema.parse(input);
  const { redactedTranscript, ...safe } = parsed;
  const hasTranscript = Boolean(redactedTranscript) || Boolean(current?.hasTranscript);
  return {
    ...safe,
    redactionStatus: hasTranscript ? 'ok' : 'failed',
    detectedLegalArea: parsed.detectedLegalArea ?? current?.detectedLegalArea ?? null,
    detectedCity: parsed.detectedCity ?? current?.detectedCity ?? null,
    matchedClinicCount: parsed.matchedClinicCount ?? current?.matchedClinicCount ?? null,
    inputTokens: (current?.inputTokens ?? 0) + parsed.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + parsed.outputTokens,
    modelUsage: mergeModelUsage(current?.modelUsage ?? {}, parsed),
    recommendedClinicIds: [
      ...new Set([...(current?.recommendedClinicIds ?? []), ...parsed.recommendedClinicIds]),
    ],
    hasTranscript,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    expiresAt: current?.expiresAt ?? retentionExpiry(now),
  };
}

function mergeModelUsage(
  current: ConversationSummary['modelUsage'],
  input: Pick<ConversationRecord, 'model' | 'inputTokens' | 'outputTokens'>,
): ConversationSummary['modelUsage'] {
  const prior = current[input.model] ?? { inputTokens: 0, outputTokens: 0 };
  return {
    ...current,
    [input.model]: {
      inputTokens: prior.inputTokens + input.inputTokens,
      outputTokens: prior.outputTokens + input.outputTokens,
    },
  };
}

export function updateTranscriptRetention(
  current: RetentionEntry[],
  id: string,
  createdAtMs: number,
): { entries: RetentionEntry[]; evictedId: string | null } {
  const present = current.some((entry) => entry.id === id);
  const sorted = [...current, ...(present ? [] : [{ id, createdAtMs }])].sort(
    (left, right) => left.createdAtMs - right.createdAtMs,
  );
  const evictedId = sorted.length > TRANSCRIPT_CAP ? sorted[0].id : null;
  return { entries: sorted.slice(-TRANSCRIPT_CAP), evictedId };
}

function encodeSummary(summary: ConversationSummary) {
  return {
    ...summary,
    createdAt: Timestamp.fromDate(summary.createdAt),
    updatedAt: Timestamp.fromDate(summary.updatedAt),
    expiresAt: Timestamp.fromDate(summary.expiresAt),
  };
}

function recordAdminMetrics(
  transaction: FirebaseFirestore.Transaction,
  current: ConversationSummary | null,
  next: ConversationSummary,
  input: ConversationRecord,
): void {
  const month = next.createdAt.toISOString().slice(0, 7);
  const day = next.createdAt.toISOString().slice(0, 10);
  const wasMatched = Number((current?.matchedClinicCount ?? 0) > 0);
  const isMatched = Number((next.matchedClinicCount ?? 0) > 0);
  const areaDeltas = legalAreaDeltas(current, next);
  transaction.set(
    firebaseFirestore().collection('adminMetrics').doc(month),
    {
      conversationCount: FieldValue.increment(current ? 0 : 1),
      matchedConversationCount: FieldValue.increment(isMatched - wasMatched),
      inputTokens: FieldValue.increment(input.inputTokens),
      outputTokens: FieldValue.increment(input.outputTokens),
      modelUsage: {
        [metricBucketId(input.model)]: {
          model: input.model,
          inputTokens: FieldValue.increment(input.inputTokens),
          outputTokens: FieldValue.increment(input.outputTokens),
        },
      },
      ...(Object.keys(areaDeltas).length > 0 ? { legalAreas: areaDeltas } : {}),
      ...(current ? {} : { dayBuckets: { [day]: FieldValue.increment(1) } }),
      updatedAt: Timestamp.fromDate(next.updatedAt),
      expiresAt: Timestamp.fromDate(next.expiresAt),
    },
    { merge: true },
  );
}

function legalAreaDeltas(
  current: ConversationSummary | null,
  next: ConversationSummary,
): Record<string, { label: string; count: FieldValue }> {
  const before = current ? (current.detectedLegalArea ?? UNKNOWN_AREA) : null;
  const after = next.detectedLegalArea ?? UNKNOWN_AREA;
  if (before === after) return {};
  return {
    ...(before ? { [metricBucketId(before)]: metricArea(before, -1) } : {}),
    [metricBucketId(after)]: metricArea(after, 1),
  };
}

function metricArea(label: string, delta: number) {
  return { label, count: FieldValue.increment(delta) };
}

export function conversationMetricDeltas(summary: ConversationSummary) {
  const legalArea = summary.detectedLegalArea ?? UNKNOWN_AREA;
  const modelUsage = Object.fromEntries(
    Object.entries(summary.modelUsage).map(([model, usage]) => [
      model,
      { inputTokens: -usage.inputTokens, outputTokens: -usage.outputTokens },
    ]),
  );
  return {
    conversationCount: -1,
    matchedConversationCount: summary.matchedClinicCount && summary.matchedClinicCount > 0 ? -1 : 0,
    inputTokens: -summary.inputTokens,
    outputTokens: -summary.outputTokens,
    day: summary.createdAt.toISOString().slice(0, 10),
    legalArea: { label: legalArea, count: -1 },
    modelUsage,
  };
}

async function record(input: ConversationRecord): Promise<void> {
  const parsed = recordSchema.parse(input);
  const database = firebaseFirestore();
  const id = parsed.sessionId ?? randomUUID();
  const summaryReference = database.collection('conversations').doc(id);
  const retentionReference = database.collection('retention').doc('conversationTranscripts');
  await database.runTransaction(async (transaction) => {
    const summarySnapshot = await transaction.get(summaryReference);
    const current = summarySnapshot.exists
      ? conversationSummarySchema.parse(summarySnapshot.data())
      : null;
    const now = new Date();
    const next = mergeConversation(current, parsed, now);
    const newClinicIds = next.recommendedClinicIds.filter(
      (clinicId) => !current?.recommendedClinicIds.includes(clinicId),
    );
    const retention = parsed.redactedTranscript ? await transaction.get(retentionReference) : null;
    let hasTranscript = next.hasTranscript;
    if (parsed.redactedTranscript) {
      hasTranscript = recordTranscript(
        transaction,
        id,
        parsed.redactedTranscript,
        next,
        retention?.data(),
      );
    }
    transaction.set(summaryReference, encodeSummary({ ...next, hasTranscript }));
    writeRecommendationEvents(transaction, id, newClinicIds, now);
    recordAdminMetrics(transaction, current, next, parsed);
  });
}

function recordTranscript(
  transaction: FirebaseFirestore.Transaction,
  id: string,
  messages: z.infer<typeof chatMessageSchema>[],
  summary: ConversationSummary,
  retentionData: unknown,
): boolean {
  const database = firebaseFirestore();
  const parsed = retentionSchema.safeParse(retentionData);
  const current = parsed.success ? parsed.data.entries : [];
  const retained = updateTranscriptRetention(current, id, summary.createdAt.getTime());
  const transcriptReference = database.collection('conversationTranscripts').doc(id);
  const keepCurrent = retained.entries.some((entry) => entry.id === id);
  if (keepCurrent) {
    transaction.set(transcriptReference, {
      messages,
      updatedAt: Timestamp.fromDate(summary.updatedAt),
      expiresAt: Timestamp.fromDate(transcriptExpiry(summary.createdAt)),
    });
  } else {
    transaction.delete(transcriptReference);
  }
  transaction.set(database.collection('retention').doc('conversationTranscripts'), {
    entries: retained.entries,
    updatedAt: Timestamp.fromDate(summary.updatedAt),
  });
  if (retained.evictedId && retained.evictedId !== id) {
    evictTranscript(transaction, retained.evictedId);
  }
  return keepCurrent;
}

function evictTranscript(transaction: FirebaseFirestore.Transaction, id: string): void {
  const database = firebaseFirestore();
  transaction.delete(database.collection('conversationTranscripts').doc(id));
  transaction.update(database.collection('conversations').doc(id), { hasTranscript: false });
}

export async function deleteConversation(conversationIdInput: string): Promise<void> {
  const conversationId = z.string().uuid().parse(conversationIdInput);
  const database = firebaseFirestore();
  await database.runTransaction(async (transaction) => {
    const summaryReference = database.doc(`conversations/${conversationId}`);
    const summarySnapshot = await transaction.get(summaryReference);
    if (!summarySnapshot.exists) return;
    const summary = conversationSummarySchema.parse(summarySnapshot.data());
    const context = await readDeletionContext(transaction, conversationId, summary);
    transaction.delete(summaryReference);
    transaction.delete(database.doc(`conversationTranscripts/${conversationId}`));
    detachRecommendationEvents(transaction, context.events);
    updateRetentionAfterDeletion(transaction, context.retentionData, conversationId);
    if (context.metricExists) deleteAdminMetrics(transaction, summary);
  });
}

async function readDeletionContext(
  transaction: FirebaseFirestore.Transaction,
  conversationId: string,
  summary: ConversationSummary,
) {
  const database = firebaseFirestore();
  const month = summary.createdAt.toISOString().slice(0, 7);
  const [retention, metric, events] = await Promise.all([
    transaction.get(database.doc('retention/conversationTranscripts')),
    transaction.get(database.doc(`adminMetrics/${month}`)),
    transaction.get(
      database.collection('clinicEvents').where('conversationId', '==', conversationId),
    ),
  ]);
  return { retentionData: retention.data(), metricExists: metric.exists, events: events.docs };
}

function detachRecommendationEvents(
  transaction: FirebaseFirestore.Transaction,
  events: FirebaseFirestore.QueryDocumentSnapshot[],
): void {
  for (const event of events) transaction.update(event.ref, { conversationId: null });
}

function updateRetentionAfterDeletion(
  transaction: FirebaseFirestore.Transaction,
  retentionData: unknown,
  conversationId: string,
): void {
  const retention = retentionSchema.safeParse(retentionData);
  if (!retention.success) return;
  transaction.set(firebaseFirestore().doc('retention/conversationTranscripts'), {
    entries: retention.data.entries.filter((entry) => entry.id !== conversationId),
    updatedAt: Timestamp.now(),
  });
}

function deleteAdminMetrics(
  transaction: FirebaseFirestore.Transaction,
  summary: ConversationSummary,
): void {
  const month = summary.createdAt.toISOString().slice(0, 7);
  const delta = conversationMetricDeltas(summary);
  transaction.set(firebaseFirestore().doc(`adminMetrics/${month}`), metricDeletionPatch(delta), {
    merge: true,
  });
}

function metricDeletionPatch(delta: ReturnType<typeof conversationMetricDeltas>) {
  const modelUsage = Object.fromEntries(
    Object.entries(delta.modelUsage).map(([model, usage]) => [
      metricBucketId(model),
      {
        model,
        inputTokens: FieldValue.increment(usage.inputTokens),
        outputTokens: FieldValue.increment(usage.outputTokens),
      },
    ]),
  );
  return {
    conversationCount: FieldValue.increment(delta.conversationCount),
    matchedConversationCount: FieldValue.increment(delta.matchedConversationCount),
    inputTokens: FieldValue.increment(delta.inputTokens),
    outputTokens: FieldValue.increment(delta.outputTokens),
    dayBuckets: { [delta.day]: FieldValue.increment(-1) },
    legalAreas: {
      [metricBucketId(delta.legalArea.label)]: {
        label: delta.legalArea.label,
        count: FieldValue.increment(delta.legalArea.count),
      },
    },
    modelUsage,
    updatedAt: Timestamp.now(),
  };
}

export const firebaseConversationStore: ConversationStore = { record };
