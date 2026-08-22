import { z } from 'zod';

import type { ChatMessage } from '@/lib/chat/schema';
import { parseMultiValue } from '@/lib/clinics/options';

import { Timestamp } from 'firebase-admin/firestore';

import { monthRange } from '@/lib/admin/month-window';

import { firebaseFirestore } from './admin';
import { loadClinicDashboardCounts, type ClinicDashboardCounts } from './admin-clinic-store';
import { conversationSummarySchema, conversationTranscriptSchema } from './conversation-store';
import { clinicDocumentSchema, firestoreDateSchema } from './documents';

const metricModelSchema = z.object({
  model: z.string().min(1).max(100),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const metricAreaSchema = z.object({
  label: z.string().min(1).max(2000),
  count: z.number().int().nonnegative(),
});

export const adminMetricSchema = z
  .object({
    conversationCount: z.number().int().nonnegative().default(0),
    matchedConversationCount: z.number().int().nonnegative().default(0),
    inputTokens: z.number().int().nonnegative().default(0),
    outputTokens: z.number().int().nonnegative().default(0),
    dayBuckets: z.record(z.iso.date(), z.number().int().nonnegative()).default({}),
    legalAreas: z.record(z.string(), metricAreaSchema).default({}),
    modelUsage: z.record(z.string(), metricModelSchema).default({}),
    updatedAt: firestoreDateSchema,
    expiresAt: firestoreDateSchema,
  })
  .strict();

export type AdminMetric = z.infer<typeof adminMetricSchema>;

export type AdminConversationRecommendation = {
  id: string;
  name: string;
  region: string | null;
  legalAreas: string[];
  website: string | null;
};

export type AdminConversationRow = {
  id: string;
  created_at: string;
  redacted_transcript: ChatMessage[] | null;
  redaction_status: 'ok' | 'failed';
  detected_legal_area: string | null;
  detected_city: string | null;
  matched_clinic_count: number | null;
  message_count: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
  recommendations: AdminConversationRecommendation[];
};

export type FirebaseDashboard = {
  counts: ClinicDashboardCounts;
  metric: AdminMetric | null;
  conversations: AdminConversationRow[];
  /** True when the month holds more conversations than were fetched. */
  hasMoreConversations: boolean;
};

/*
 * Conversations are scoped to the selected month so the list agrees with every
 * other figure on the page. The range filter and the ordering are both on
 * `createdAt`, so Firestore serves this from the automatic single-field index —
 * no composite index is required.
 */
function monthConversations(month: string, limit: number) {
  const { startIso, endIso } = monthRange(month);
  return firebaseFirestore()
    .collection('conversations')
    .where('createdAt', '>=', Timestamp.fromDate(new Date(startIso)))
    .where('createdAt', '<', Timestamp.fromDate(new Date(endIso)))
    .orderBy('createdAt', 'desc')
    .limit(limit);
}

export async function loadAdminDashboard(
  month: string,
  conversationLimit: number,
): Promise<FirebaseDashboard> {
  // One extra row answers "is there more?" without a second count query.
  const probeLimit = conversationLimit + 1;
  const [counts, metricSnapshot, conversationSnapshot] = await Promise.all([
    loadClinicDashboardCounts(),
    firebaseFirestore().collection('adminMetrics').doc(month).get(),
    monthConversations(month, probeLimit).get(),
  ]);
  const metric = metricSnapshot.exists ? adminMetricSchema.parse(metricSnapshot.data()) : null;
  const hasMoreConversations = conversationSnapshot.size === probeLimit;
  const page = conversationSnapshot.docs.slice(0, conversationLimit);
  const conversations = await hydrateConversations(page);
  return { counts, metric, conversations, hasMoreConversations };
}

async function hydrateConversations(
  documents: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<AdminConversationRow[]> {
  if (documents.length === 0) return [];
  const database = firebaseFirestore();
  const summaries = documents.map((document) => conversationSummarySchema.parse(document.data()));
  const transcriptIds = documents.filter((_, index) => summaries[index].hasTranscript);
  const transcriptSnapshots = transcriptIds.length
    ? await database.getAll(
        ...transcriptIds.map((document) => database.doc(`conversationTranscripts/${document.id}`)),
      )
    : [];
  const transcripts = new Map(
    transcriptSnapshots.map((snapshot) => [
      snapshot.id,
      snapshot.exists ? conversationTranscriptSchema.parse(snapshot.data()).messages : null,
    ]),
  );
  const clinics = await loadRecommendedClinics(
    summaries.flatMap((row) => row.recommendedClinicIds),
  );
  return documents.map((document, index) =>
    conversationRow(document.id, summaries[index], transcripts.get(document.id) ?? null, clinics),
  );
}

async function loadRecommendedClinics(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map<string, AdminConversationRecommendation>();
  const database = firebaseFirestore();
  const snapshots = await database.getAll(...uniqueIds.map((id) => database.doc(`clinics/${id}`)));
  const clinics = new Map<string, AdminConversationRecommendation>();
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const clinic = clinicDocumentSchema.parse(snapshot.data());
    clinics.set(snapshot.id, {
      id: snapshot.id,
      name: clinic.name,
      region: clinic.region,
      legalAreas: parseMultiValue(clinic.legalAreas),
      website: clinic.website,
    });
  }
  return clinics;
}

function conversationRow(
  id: string,
  summary: z.infer<typeof conversationSummarySchema>,
  transcript: ChatMessage[] | null,
  clinics: Map<string, AdminConversationRecommendation>,
): AdminConversationRow {
  return {
    id,
    created_at: summary.createdAt.toISOString(),
    redacted_transcript: transcript,
    redaction_status: summary.redactionStatus,
    detected_legal_area: summary.detectedLegalArea,
    detected_city: summary.detectedCity,
    matched_clinic_count: summary.matchedClinicCount,
    message_count: summary.messageCount,
    model: summary.model,
    input_tokens: summary.inputTokens,
    output_tokens: summary.outputTokens,
    recommendations: summary.recommendedClinicIds.flatMap((clinicId) => {
      const clinic = clinics.get(clinicId);
      return clinic ? [clinic] : [];
    }),
  };
}
