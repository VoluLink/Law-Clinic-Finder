import { randomUUID } from 'node:crypto';

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { ClinicEventCounts } from '@/lib/clinic/stats';
import type { ClinicClick, ClinicClickStore } from '@/lib/clinics/click-event';

import { firebaseFirestore } from './admin';
import { clinicDocumentSchema } from './documents';

const RETENTION_MS = 366 * 86_400_000;

const metricSchema = z.object({
  recommendedCount: z.number().int().nonnegative().default(0),
  websiteClickCount: z.number().int().nonnegative().default(0),
  emailClickCount: z.number().int().nonnegative().default(0),
  recommendationDays: z.record(z.iso.date(), z.number().int().nonnegative()).default({}),
});

export type ClinicMetricSummary = {
  counts: ClinicEventCounts;
  recommendationDays: Record<string, number>;
};

function expiry(now: Date): Timestamp {
  return Timestamp.fromMillis(now.getTime() + RETENTION_MS);
}

function metricReference(clinicId: string, now: Date) {
  const month = now.toISOString().slice(0, 7);
  return firebaseFirestore().doc(`clinicMetrics/${clinicId}/months/${month}`);
}

function writeMetric(
  transaction: FirebaseFirestore.Transaction,
  clinicId: string,
  kind: 'recommended' | 'click_website' | 'click_email',
  now: Date,
): void {
  const field =
    kind === 'recommended'
      ? 'recommendedCount'
      : kind === 'click_website'
        ? 'websiteClickCount'
        : 'emailClickCount';
  const day = now.toISOString().slice(0, 10);
  transaction.set(
    metricReference(clinicId, now),
    {
      [field]: FieldValue.increment(1),
      ...(kind === 'recommended' ? { recommendationDays: { [day]: FieldValue.increment(1) } } : {}),
      updatedAt: Timestamp.fromDate(now),
      expiresAt: expiry(now),
    },
    { merge: true },
  );
}

export function writeRecommendationEvents(
  transaction: FirebaseFirestore.Transaction,
  conversationId: string,
  clinicIds: string[],
  now: Date,
): void {
  for (const clinicId of clinicIds) {
    const id = `${conversationId}_${clinicId}`;
    transaction.set(firebaseFirestore().collection('clinicEvents').doc(id), {
      clinicId,
      kind: 'recommended',
      conversationId,
      createdAt: Timestamp.fromDate(now),
      expiresAt: expiry(now),
    });
    writeMetric(transaction, clinicId, 'recommended', now);
  }
}

async function recordClick(input: ClinicClick): Promise<boolean> {
  const database = firebaseFirestore();
  const now = new Date();
  const clinicReference = database.collection('clinics').doc(input.clinicId);
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(clinicReference);
    if (!snapshot.exists) return false;
    const clinic = clinicDocumentSchema.parse(snapshot.data());
    if (!clinic.isPublished) return false;
    transaction.set(database.collection('clinicEvents').doc(randomUUID()), {
      clinicId: input.clinicId,
      kind: input.kind,
      conversationId: null,
      createdAt: Timestamp.fromDate(now),
      expiresAt: expiry(now),
    });
    writeMetric(transaction, input.clinicId, input.kind, now);
    return true;
  });
}

export const firebaseClinicClickStore: ClinicClickStore = { recordClick };

export async function loadClinicMetrics(clinicId: string): Promise<ClinicMetricSummary> {
  const safeId = z.string().uuid().parse(clinicId);
  const snapshot = await firebaseFirestore()
    .collection('clinicMetrics')
    .doc(safeId)
    .collection('months')
    .get();
  const metrics = snapshot.docs.map((document) => metricSchema.parse(document.data()));
  return {
    counts: {
      recommended_count: metrics.reduce((sum, metric) => sum + metric.recommendedCount, 0),
      website_click_count: metrics.reduce((sum, metric) => sum + metric.websiteClickCount, 0),
      email_click_count: metrics.reduce((sum, metric) => sum + metric.emailClickCount, 0),
    },
    recommendationDays: mergeDayCounts(metrics.map((metric) => metric.recommendationDays)),
  };
}

function mergeDayCounts(days: Array<Record<string, number>>): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const entries of days) {
    for (const [day, count] of Object.entries(entries)) {
      merged[day] = (merged[day] ?? 0) + count;
    }
  }
  return merged;
}
