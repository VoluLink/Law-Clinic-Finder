import { z } from 'zod';

import type { ChatMessage } from '@/lib/chat/schema';
import { REGION_SUGGESTIONS } from '@/lib/clinics/options';
import { logger } from '@/lib/logger';

/**
 * The de-identification boundary for everything a visitor types, on its way to
 * the model and to storage.
 *
 * Google Cloud Sensitive Data Protection is the redactor. There is deliberately
 * no local fallback engine: if DLP cannot inspect a message, the caller refuses
 * the turn. Quietly forwarding an un-inspected message would defeat the whole
 * boundary, so every failure path here returns `ok: false` and never the input.
 */

export const DLP_INFO_TYPES = [
  'CREDIT_CARD_NUMBER',
  'DATE_OF_BIRTH',
  'EMAIL_ADDRESS',
  'GERMANY_DRIVERS_LICENSE_NUMBER',
  'GERMANY_IDENTITY_CARD_NUMBER',
  'GERMANY_PASSPORT',
  'GERMANY_SCHUFA_ID',
  'GERMANY_TAXPAYER_IDENTIFICATION_NUMBER',
  'IBAN_CODE',
  'IP_ADDRESS',
  'PERSON_NAME',
  'PHONE_NUMBER',
  'SWIFT_CODE',
] as const;

/**
 * Location detectors that must never be requested. The finder's entire job is
 * matching someone to a clinic near them, and the model only knows where they
 * are because they wrote it — so redacting the place would break the product
 * while looking like a privacy improvement.
 */
export const FORBIDDEN_INFO_TYPES = [
  'GEOGRAPHIC_DATA',
  'LOCATION',
  'LOCATION_COORDINATES',
  'STREET_ADDRESS',
] as const;

export type DeidentifyFailure = 'unconfigured' | 'timeout' | 'rejected' | 'unavailable';

export type DeidentifyResult =
  { ok: true; messages: ChatMessage[] } | { ok: false; reason: DeidentifyFailure };

type Attempt = DeidentifyResult & { retryable?: boolean };

const DLP_TIMEOUT_MS = 1_500;
const DLP_MAX_ATTEMPTS = 2;
const DLP_RETRY_BASE_MS = 120;
const DLP_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_DLP_LOCATION = 'europe-west4';
const TABLE_COLUMN = 'message';
const POSTAL_CODE_PATTERN = /\d{5}/g;

const DEIDENTIFY_CONFIG = {
  infoTypeTransformations: {
    transformations: [{ primitiveTransformation: { replaceWithInfoTypeConfig: {} } }],
  },
} as const;

const tableResponseSchema = z.object({
  item: z.object({
    table: z.object({
      rows: z.array(z.object({ values: z.array(z.object({ stringValue: z.string() })).min(1) })),
    }),
  }),
});

/**
 * A German state or Regierungsbezirk reads like a surname often enough that
 * PERSON_NAME will occasionally claim one. Excluding the finder's own region
 * vocabulary keeps the search term intact without weakening name detection
 * anywhere else.
 */
function inspectConfig() {
  return {
    infoTypes: DLP_INFO_TYPES.map((name) => ({ name })),
    minLikelihood: 'LIKELY',
    ruleSet: [
      {
        infoTypes: [{ name: 'PERSON_NAME' }],
        rules: [
          {
            exclusionRule: {
              dictionary: { wordList: { words: [...REGION_SUGGESTIONS] } },
              matchingType: 'MATCHING_TYPE_FULL_MATCH',
            },
          },
          {
            exclusionRule: {
              excludeByHotword: {
                hotwordRegex: { pattern: '\\d{5}' },
                proximity: { windowBefore: 8 },
              },
              matchingType: 'MATCHING_TYPE_PARTIAL_MATCH',
            },
          },
        ],
      },
    ],
  };
}

/** One row per message: DLP inspects each in isolation, and a single request
 *  costs one network hop however long the transcript has grown. */
function tableItem(messages: ChatMessage[]) {
  return {
    table: {
      headers: [{ name: TABLE_COLUMN }],
      rows: messages.map((message) => ({ values: [{ stringValue: message.content }] })),
    },
  };
}

/**
 * Configuration keeps every location detector off; this refuses a response that
 * dropped a place anyway. It can only see what the app has vocabulary for —
 * postal codes and the region list — so a bare city name still relies on DLP not
 * classifying it as a person.
 */
function preservesPlaces(before: string, after: string): boolean {
  const postalCodes = before.match(POSTAL_CODE_PATTERN) ?? [];
  if (postalCodes.some((code) => !after.includes(code))) return false;
  return REGION_SUGGESTIONS.every((region) => !before.includes(region) || after.includes(region));
}

async function accessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const token = await new GoogleAuth({ scopes: [DLP_SCOPE] }).getAccessToken();
  if (!token) throw new Error('no access token');
  return token;
}

function endpoint(project: string): string {
  const location = process.env.DLP_LOCATION || DEFAULT_DLP_LOCATION;
  return `https://dlp.googleapis.com/v2/projects/${project}/locations/${location}/content:deidentify`;
}

function httpFailure(status: number): Attempt {
  const retryable = status === 429 || status >= 500;
  return { ok: false, reason: retryable ? 'unavailable' : 'rejected', retryable };
}

function connectionFailure(error: unknown): Attempt {
  const aborted = error instanceof Error && error.name === 'AbortError';
  return { ok: false, reason: aborted ? 'timeout' : 'unavailable', retryable: true };
}

function readRows(messages: ChatMessage[], body: unknown): Attempt {
  const parsed = tableResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: 'rejected' };
  const { rows } = parsed.data.item.table;
  if (rows.length !== messages.length) return { ok: false, reason: 'rejected' };
  const deidentified = messages.map((message, index) => ({
    role: message.role,
    content: rows[index].values[0].stringValue,
  }));
  const kept = deidentified.every((message, index) =>
    preservesPlaces(messages[index].content, message.content),
  );
  return kept ? { ok: true, messages: deidentified } : { ok: false, reason: 'rejected' };
}

async function requestDeidentification(project: string, messages: ChatMessage[]): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DLP_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(project), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        item: tableItem(messages),
        deidentifyConfig: DEIDENTIFY_CONFIG,
        inspectConfig: inspectConfig(),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    return response.ok ? readRows(messages, await response.json()) : httpFailure(response.status);
  } catch (error) {
    return connectionFailure(error);
  } finally {
    clearTimeout(timer);
  }
}

function configuredProject(): string | null {
  if (process.env.REDACTION_PROVIDER !== 'dlp') return null;
  return process.env.FIREBASE_PROJECT_ID || null;
}

/**
 * Without an escape hatch there is no working chat outside production, because
 * DLP needs credentials and an enabled API. Deliberately impossible to switch on
 * in production, and loud on every request so it can never pass for normal.
 */
function bypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.REDACTION_PROVIDER === 'none';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refuse(reason: DeidentifyFailure): DeidentifyResult {
  logger.warn('chat de-identification unavailable', { reason });
  return { ok: false, reason };
}

export async function deidentifyMessages(messages: ChatMessage[]): Promise<DeidentifyResult> {
  if (bypassEnabled()) {
    logger.warn('chat de-identification bypassed', { reason: 'development override' });
    return { ok: true, messages };
  }
  const project = configuredProject();
  if (!project) return refuse('unconfigured');
  let attempt: Attempt = { ok: false, reason: 'unavailable' };
  for (let round = 0; round < DLP_MAX_ATTEMPTS; round += 1) {
    attempt = await requestDeidentification(project, messages);
    if (attempt.ok || !attempt.retryable) break;
    await delay(DLP_RETRY_BASE_MS * (0.5 + Math.random()));
  }
  return attempt.ok ? { ok: true, messages: attempt.messages } : refuse(attempt.reason);
}
