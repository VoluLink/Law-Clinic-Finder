import { createHash } from 'node:crypto';

import { z } from 'zod';

import { chatMessageSchema } from '../../src/lib/chat/schema';
import { metricBucketId } from '../../src/lib/admin/metric-bucket';
import { brandingSchema } from '../../src/lib/branding/branding';
import { publicWebsiteUrlSchema } from '../../src/lib/clinics/schema';
import { parseChatSettings } from '../../src/lib/settings';

const RETENTION_MS = 366 * 86_400_000;
const timestampSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const nullableText = (max: number) => z.string().max(max).nullable();

export const sourceClinicSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  description: nullableText(2_000),
  region: nullableText(1_000),
  contact_email: z.email().nullable(),
  website: publicWebsiteUrlSchema.nullable(),
  legal_areas: z.string().max(2_000),
  target_clients: nullableText(2_000),
  languages: nullableText(1_000),
  requirements: nullableText(4_000),
  advises_clients: z.boolean(),
  is_published: z.boolean(),
  approval_status: z.enum(['pending', 'approved']),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const sourceProfileSchema = z.object({
  user_id: z.string().min(1).max(128),
  role: z.enum(['admin', 'clinic']),
  clinic_id: z.uuid().nullable(),
  access_status: z.enum(['pending', 'active']),
  activated_at: timestampSchema.nullable(),
  created_at: timestampSchema,
});

export const sourceConversationSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid().nullable(),
  created_at: timestampSchema,
  redacted_transcript: chatMessageSchema.array().max(17).nullable(),
  redaction_status: z.enum(['ok', 'failed']),
  detected_legal_area: nullableText(2_000),
  detected_city: nullableText(1_000),
  matched_clinic_count: z.number().int().nonnegative().nullable(),
  message_count: z.number().int().nonnegative().max(17),
  model: z.string().min(1).max(100),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export const sourceClinicEventSchema = z.object({
  id: z.uuid(),
  clinic_id: z.uuid(),
  kind: z.enum(['recommended', 'click_website', 'click_email']),
  conversation_id: z.uuid().nullable(),
  created_at: timestampSchema,
});

export const sourceClaimAttemptSchema = z.object({
  clinic_id: z.uuid(),
  sent_at: timestampSchema,
});

export const sourceSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.json(),
  updated_at: timestampSchema,
});

export const sourceBrandingSchema = z.object({
  wordmark: z.string(),
  logo_url: z.url().nullable(),
  color_primary: z.string(),
  color_background: z.string(),
  color_accent: z.string(),
  color_foreground: z.string(),
  font: z.string(),
  updated_at: timestampSchema,
});

export const sourceLogSchema = z.object({
  id: z.uuid(),
  logged_at: timestampSchema,
  level: z.enum(['debug', 'info', 'warn', 'error']),
  msg: z.string().min(1).max(1_000),
  fields: z.record(z.string(), z.json()).nullable(),
});

export const sourceAuthUserSchema = z.object({
  id: z.string().min(1).max(128),
  email: z.email(),
  email_confirmed_at: timestampSchema.nullish(),
  confirmed_at: timestampSchema.nullish(),
  created_at: timestampSchema,
  updated_at: timestampSchema.nullish(),
  banned_until: timestampSchema.nullish(),
});

export function transformClinic(input: unknown) {
  const row = sourceClinicSchema.parse(input);
  return {
    id: row.id,
    clinic: {
      name: row.name,
      description: row.description,
      region: row.region,
      website: row.website,
      legalAreas: row.legal_areas,
      targetClients: row.target_clients,
      languages: row.languages,
      requirements: row.requirements,
      advisesClients: row.advises_clients,
      isPublished: row.is_published,
      approvalStatus: row.approval_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    contact: row.contact_email ? { contactEmail: row.contact_email.toLowerCase() } : null,
  };
}

export function transformProfile(input: unknown) {
  const row = sourceProfileSchema.parse(input);
  if (row.role === 'clinic' && !row.clinic_id) throw new Error('clinic profile has no clinic');
  const claims = {
    role: row.role,
    ...(row.clinic_id ? { clinicId: row.clinic_id } : {}),
    accessStatus: row.access_status,
  };
  return {
    id: row.user_id,
    profile: {
      role: row.role,
      clinicId: row.clinic_id,
      accessStatus: row.access_status,
      activatedAt: row.activated_at,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    },
    claims,
  };
}

export function transformConversation(input: unknown, recommendedClinicIds: string[]) {
  const row = sourceConversationSchema.parse(input);
  const recommendations = z
    .array(z.uuid())
    .max(8)
    .parse([...new Set(recommendedClinicIds)]);
  const expiresAt = new Date(row.created_at.getTime() + RETENTION_MS);
  const hasTranscript = row.redacted_transcript !== null;
  return {
    id: row.id,
    summary: {
      sessionId: row.session_id,
      redactionStatus: hasTranscript ? 'ok' : 'failed',
      detectedLegalArea: row.detected_legal_area,
      detectedCity: row.detected_city,
      matchedClinicCount: row.matched_clinic_count,
      messageCount: row.message_count,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      recommendedClinicIds: recommendations,
      modelUsage: {
        [row.model]: { inputTokens: row.input_tokens, outputTokens: row.output_tokens },
      },
      hasTranscript,
      createdAt: row.created_at,
      updatedAt: row.created_at,
      expiresAt,
    },
    transcript: row.redacted_transcript
      ? { messages: row.redacted_transcript, updatedAt: row.created_at, expiresAt }
      : null,
  };
}

export function transformSettings(inputs: unknown[]) {
  const rows = inputs.map((input) => sourceSettingSchema.parse(input));
  const parsed = parseChatSettings(rows.map(({ key, value }) => ({ key, value })));
  const values = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  const defaults = ['chat_system_prompt_default', 'chat_skill_default'];
  const missingDefaults = defaults.filter(
    (key) => !z.string().min(1).safeParse(values[key]).success,
  );
  const missing = [...(parsed.ok ? [] : parsed.missing), ...missingDefaults];
  if (missing.length > 0) throw new Error(`Missing or invalid settings: ${missing.join(', ')}`);
  const updatedAt = latestDate(rows.map((row) => row.updated_at));
  return { values, updatedAt };
}

export function transformBranding(input: unknown, logoPath: string | null) {
  const row = sourceBrandingSchema.parse(input);
  const branding = brandingSchema.parse({
    wordmark: row.wordmark,
    logo_url: row.logo_url,
    color_primary: row.color_primary,
    color_background: row.color_background,
    color_accent: row.color_accent,
    color_foreground: row.color_foreground,
    font: row.font,
  });
  return {
    wordmark: branding.wordmark,
    logoPath,
    colorPrimary: branding.color_primary,
    colorBackground: branding.color_background,
    colorAccent: branding.color_accent,
    colorForeground: branding.color_foreground,
    font: branding.font,
    updatedAt: row.updated_at,
  };
}

export function transformClinicEvent(input: unknown) {
  const row = sourceClinicEventSchema.parse(input);
  return {
    id: row.id,
    event: {
      clinicId: row.clinic_id,
      kind: row.kind,
      conversationId: row.conversation_id,
      createdAt: row.created_at,
      expiresAt: new Date(row.created_at.getTime() + RETENTION_MS),
    },
  };
}

export function transformLog(input: unknown) {
  const row = sourceLogSchema.parse(input);
  return {
    id: row.id,
    log: {
      loggedAt: row.logged_at,
      level: row.level,
      msg: row.msg,
      fields: row.fields,
      expiresAt: new Date(row.logged_at.getTime() + 7 * 86_400_000),
    },
  };
}

export function transformAuthUser(input: unknown, now = new Date()) {
  const row = sourceAuthUserSchema.parse(input);
  return {
    uid: row.id,
    email: row.email.toLowerCase(),
    emailVerified: Boolean(row.email_confirmed_at ?? row.confirmed_at),
    disabled: Boolean(row.banned_until && row.banned_until > now),
  };
}

type TransformedConversation = ReturnType<typeof transformConversation>;

type AdminMetricDocument = {
  conversationCount: number;
  matchedConversationCount: number;
  inputTokens: number;
  outputTokens: number;
  dayBuckets: Record<string, number>;
  legalAreas: Record<string, { label: string; count: number }>;
  modelUsage: Record<string, { model: string; inputTokens: number; outputTokens: number }>;
  updatedAt: Date;
  expiresAt: Date;
};

export function buildAdminMetrics(
  conversations: TransformedConversation[],
): Map<string, AdminMetricDocument> {
  const metrics = new Map<string, AdminMetricDocument>();
  for (const conversation of conversations) {
    const month = conversation.summary.createdAt.toISOString().slice(0, 7);
    const metric = metrics.get(month) ?? emptyAdminMetric(conversation.summary);
    addConversationMetric(metric, conversation.summary);
    metrics.set(month, metric);
  }
  return metrics;
}

function emptyAdminMetric(summary: TransformedConversation['summary']): AdminMetricDocument {
  return {
    conversationCount: 0,
    matchedConversationCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    dayBuckets: {},
    legalAreas: {},
    modelUsage: {},
    updatedAt: summary.updatedAt,
    expiresAt: summary.expiresAt,
  };
}

function addConversationMetric(
  metric: AdminMetricDocument,
  summary: TransformedConversation['summary'],
): void {
  metric.conversationCount += 1;
  metric.matchedConversationCount += Number((summary.matchedClinicCount ?? 0) > 0);
  metric.inputTokens += summary.inputTokens;
  metric.outputTokens += summary.outputTokens;
  increment(metric.dayBuckets, summary.createdAt.toISOString().slice(0, 10));
  addLegalArea(metric, summary.detectedLegalArea ?? 'Unbekannt');
  addModelUsage(metric, summary.model, summary.inputTokens, summary.outputTokens);
  if (summary.updatedAt > metric.updatedAt) metric.updatedAt = summary.updatedAt;
  if (summary.expiresAt > metric.expiresAt) metric.expiresAt = summary.expiresAt;
}

function addLegalArea(metric: AdminMetricDocument, label: string): void {
  const id = metricBucketId(label);
  const current = metric.legalAreas[id] ?? { label, count: 0 };
  metric.legalAreas[id] = { label, count: current.count + 1 };
}

function addModelUsage(
  metric: AdminMetricDocument,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const id = metricBucketId(model);
  const current = metric.modelUsage[id] ?? { model, inputTokens: 0, outputTokens: 0 };
  metric.modelUsage[id] = {
    model,
    inputTokens: current.inputTokens + inputTokens,
    outputTokens: current.outputTokens + outputTokens,
  };
}

type ClinicMetricDocument = {
  recommendedCount: number;
  websiteClickCount: number;
  emailClickCount: number;
  recommendationDays: Record<string, number>;
  updatedAt: Date;
  expiresAt: Date;
};

export function buildClinicMetrics(events: unknown[]): Map<string, ClinicMetricDocument> {
  const metrics = new Map<string, ClinicMetricDocument>();
  for (const input of events) {
    const event = sourceClinicEventSchema.parse(input);
    const month = event.created_at.toISOString().slice(0, 7);
    const key = `${event.clinic_id}/${month}`;
    const metric = metrics.get(key) ?? emptyClinicMetric(event.created_at);
    addClinicEvent(metric, event.kind, event.created_at);
    metrics.set(key, metric);
  }
  return metrics;
}

function emptyClinicMetric(createdAt: Date): ClinicMetricDocument {
  return {
    recommendedCount: 0,
    websiteClickCount: 0,
    emailClickCount: 0,
    recommendationDays: {},
    updatedAt: createdAt,
    expiresAt: new Date(createdAt.getTime() + RETENTION_MS),
  };
}

function addClinicEvent(
  metric: ClinicMetricDocument,
  kind: z.infer<typeof sourceClinicEventSchema>['kind'],
  createdAt: Date,
): void {
  if (kind === 'recommended') {
    metric.recommendedCount += 1;
    increment(metric.recommendationDays, createdAt.toISOString().slice(0, 10));
  } else if (kind === 'click_website') metric.websiteClickCount += 1;
  else metric.emailClickCount += 1;
  if (createdAt > metric.updatedAt) metric.updatedAt = createdAt;
  const expiresAt = new Date(createdAt.getTime() + RETENTION_MS);
  if (expiresAt > metric.expiresAt) metric.expiresAt = expiresAt;
}

export function buildClaimLimits(
  attempts: unknown[],
  now: Date,
): Map<string, { attempts: Date[]; expiresAt: Date }> {
  const cutoff = now.getTime() - 7 * 86_400_000;
  const grouped = new Map<string, Date[]>();
  for (const input of attempts) {
    const attempt = sourceClaimAttemptSchema.parse(input);
    if (attempt.sent_at.getTime() < cutoff) continue;
    grouped.set(attempt.clinic_id, [...(grouped.get(attempt.clinic_id) ?? []), attempt.sent_at]);
  }
  return new Map(
    [...grouped].map(([clinicId, dates]) => {
      const recent = dates.sort((left, right) => left.getTime() - right.getTime()).slice(-2);
      const expiresAt = new Date(recent.at(-1)!.getTime() + 7 * 86_400_000);
      return [clinicId, { attempts: recent, expiresAt }];
    }),
  );
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function checksumRecords(records: unknown[]): string {
  const canonical = records
    .map(stableValue)
    .map((value) => JSON.stringify(value))
    .sort()
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;
  if ('toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date) return date.toISOString();
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function latestDate(dates: Date[]): Date {
  if (dates.length === 0) throw new Error('No timestamped rows supplied');
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
