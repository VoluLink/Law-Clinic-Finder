import { z } from 'zod';

import { redactPatterns } from '@/lib/chat/redact';
import { logger } from '@/lib/logger';

/**
 * Provider-neutral de-identification for text on its way to the model.
 *
 * The local engine in `@/lib/chat/redact` is always the baseline: it costs
 * nothing, adds no latency, never leaves the process and is deterministic. Google
 * Cloud Sensitive Data Protection can be layered on top via `REDACTION_PROVIDER`
 * for its maintained German detectors, but it is an extra network hop on the hot
 * path and an extra processor, so it is opt-in rather than the default.
 *
 * It runs *after* the local pass and can only remove more, never restore.
 */

/**
 * Deliberately omits LOCATION, STREET_ADDRESS and GERMANY_POSTAL_CODE.
 *
 * The finder's whole job is matching someone to a clinic near them, and the model
 * only knows where they are because they wrote it. Letting DLP strip a city would
 * break the product while looking like a privacy improvement. Street-level detail
 * is already handled locally, which keeps the city intact.
 */
export const DLP_INFO_TYPES = [
  'CREDIT_CARD_NUMBER',
  'DATE_OF_BIRTH',
  'EMAIL_ADDRESS',
  'GERMANY_DRIVERS_LICENSE_NUMBER',
  'GERMANY_IDENTITY_CARD_NUMBER',
  'GERMANY_PASSPORT',
  'GERMANY_TAXPAYER_IDENTIFICATION_NUMBER',
  'IBAN_CODE',
  'IP_ADDRESS',
  'PERSON_NAME',
  'PHONE_NUMBER',
  'SWIFT_CODE',
] as const;

/** Location detectors that must never be enabled — see the note above. */
export const FORBIDDEN_INFO_TYPES = ['LOCATION', 'STREET_ADDRESS', 'GERMANY_POSTAL_CODE'] as const;

const DLP_TIMEOUT_MS = 1_500;
const DLP_ENDPOINT = 'https://dlp.googleapis.com/v2';
const DLP_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const providerSchema = z.enum(['local', 'dlp']).catch('local');

export function redactionProvider(): 'local' | 'dlp' {
  return providerSchema.parse(process.env.REDACTION_PROVIDER);
}

const deidentifyResultSchema = z.object({ item: z.object({ value: z.string() }) });

function deidentifyRequest() {
  return {
    deidentifyConfig: {
      infoTypeTransformations: {
        transformations: [{ primitiveTransformation: { replaceWithInfoTypeConfig: {} } }],
      },
    },
    inspectConfig: {
      infoTypes: DLP_INFO_TYPES.map((name) => ({ name })),
      minLikelihood: 'LIKELY',
    },
  };
}

async function accessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const token = await new GoogleAuth({ scopes: [DLP_SCOPE] }).getAccessToken();
  if (!token) throw new Error('no access token');
  return token;
}

async function deidentifyWithDlp(text: string, projectId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DLP_TIMEOUT_MS);
  try {
    const response = await fetch(`${DLP_ENDPOINT}/projects/${projectId}/content:deidentify`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...deidentifyRequest(), item: { value: text } }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`http ${response.status}`);
    return deidentifyResultSchema.parse(await response.json()).item.value;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Always returns text that has at least been through the local engine. A DLP
 * failure degrades to that rather than to the original message — failing open to
 * raw text would defeat the entire boundary.
 */
export async function deidentify(text: string, projectId?: string): Promise<string> {
  const local = redactPatterns(text);
  if (redactionProvider() !== 'dlp') return local;
  const project = projectId ?? process.env.FIREBASE_PROJECT_ID;
  if (!project) {
    logger.warn('dlp de-identification unavailable', { reason: 'not configured' });
    return local;
  }
  try {
    return await deidentifyWithDlp(local, project);
  } catch (error) {
    logger.warn('dlp de-identification unavailable', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return local;
  }
}
