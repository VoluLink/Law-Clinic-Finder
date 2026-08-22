import 'server-only';

import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

import { currentMonthKey, monthRange, parseMonthKey } from '@/lib/admin/month-window';
import { logger } from '@/lib/logger';

export type GaMetrics = { users: number; sessions: number; avgEngagementSeconds: number };

const ANALYTICS_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATA_API_BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';
/** Requested metrics, in the order the response repeats them back per row. */
const REPORT_METRICS = ['totalUsers', 'sessions', 'averageSessionDuration'] as const;
/** No dimensions are requested, so the report is a single totals row. */
const REPORT_ROW_LIMIT = 1;
const REQUEST_TIMEOUT_MS = 8_000;
/** One report per warm instance and month keeps the dashboard off the Data API
 *  quota. A failed outcome is cached too, so an outage costs one call per
 *  window instead of one per render. */
const CACHE_MS = 5 * 60 * 1_000;
const MS_PER_DAY = 24 * 60 * 60 * 1_000;
/** Length of the `YYYY-MM-DD` prefix of an ISO timestamp. */
const ISO_DAY_LENGTH = 10;
const WARNING = 'ga metrics unavailable';

/** Carries a short, fixed reason — never the credential, the access token, or
 *  any part of a request or response body. */
class GaReportError extends Error {
  constructor(readonly reason: string) {
    super(`GA report failed: ${reason}`);
    this.name = 'GaReportError';
  }
}

/** The Data API addresses the numeric property id, not the `G-` measurement id. */
const propertyIdSchema = z.string().regex(/^\d{1,20}$/);

const credentialsSchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
});

/** The Data API serialises every metric value as a decimal string. */
const metricValueSchema = z.object({
  value: z
    .string()
    .regex(/^-?\d+(?:\.\d+)?$/)
    .transform(Number),
});

const reportSchema = z.object({
  rows: z
    .array(
      z.object({
        metricValues: z.tuple([metricValueSchema, metricValueSchema, metricValueSchema]),
      }),
    )
    .optional()
    .default([]),
});

type Credentials = z.infer<typeof credentialsSchema>;
type GaEnvironment = { propertyId: string; credentials: Credentials };

function parseCredentials(raw: string): Credentials {
  try {
    return credentialsSchema.parse(JSON.parse(raw));
  } catch {
    // Deliberately dropped: a parse or validation error can quote the key.
    throw new GaReportError('invalid credentials');
  }
}

function readEnvironment(): GaEnvironment {
  const propertyId = process.env.GA_PROPERTY_ID?.trim();
  const rawCredentials = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!propertyId || !rawCredentials) throw new GaReportError('not configured');
  if (!propertyIdSchema.safeParse(propertyId).success) {
    throw new GaReportError('invalid property id');
  }
  return { propertyId, credentials: parseCredentials(rawCredentials) };
}

let auth: GoogleAuth | null = null;

async function authorization(credentials: Credentials): Promise<string> {
  auth ??= new GoogleAuth({ credentials, scopes: [ANALYTICS_READONLY_SCOPE] });
  const token = await auth.getAccessToken();
  if (!token) throw new GaReportError('authentication');
  return `Bearer ${token}`;
}

/** GA4 date ranges are inclusive at both ends, so the last day is one day
 *  before the half-open end `monthRange` returns. */
function dateRange(month: string): { startDate: string; endDate: string } {
  const { startIso, endIso } = monthRange(month);
  const lastDay = new Date(Date.parse(endIso) - MS_PER_DAY);
  return {
    startDate: startIso.slice(0, ISO_DAY_LENGTH),
    endDate: lastDay.toISOString().slice(0, ISO_DAY_LENGTH),
  };
}

async function postReport(
  env: GaEnvironment,
  month: string,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(`${DATA_API_BASE_URL}/properties/${env.propertyId}:runReport`, {
    method: 'POST',
    headers: {
      authorization: await authorization(env.credentials),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [dateRange(month)],
      metrics: REPORT_METRICS.map((name) => ({ name })),
      limit: REPORT_ROW_LIMIT,
    }),
    signal,
    cache: 'no-store',
  });
}

/** Rejects the moment the deadline fires, so a hanging token exchange cannot
 *  outlive the request budget either. */
function deadline(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new GaReportError('timeout')), { once: true });
  });
}

function toMetrics(body: unknown): GaMetrics {
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) throw new GaReportError('malformed report');
  const row = parsed.data.rows[0];
  if (!row) return { users: 0, sessions: 0, avgEngagementSeconds: 0 };
  const [users, sessions, duration] = row.metricValues;
  return {
    users: Math.round(users.value),
    sessions: Math.round(sessions.value),
    avgEngagementSeconds: Math.round(duration.value),
  };
}

async function runReport(month: string): Promise<GaMetrics> {
  const env = readEnvironment();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await Promise.race([
      postReport(env, month, controller.signal),
      deadline(controller.signal),
    ]);
    if (!response.ok) throw new GaReportError(`http ${response.status}`);
    return toMetrics(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function failureReason(error: unknown): string {
  if (error instanceof GaReportError) return error.reason;
  if (error instanceof Error) return error.name === 'AbortError' ? 'timeout' : error.name;
  return 'unknown';
}

async function reportOrNull(month: string): Promise<GaMetrics | null> {
  try {
    return await runReport(month);
  } catch (error) {
    logger.warn(WARNING, { reason: failureReason(error) });
    return null;
  }
}

type CacheEntry = { expiresAt: number; metrics: GaMetrics | null };

const cache = new Map<string, CacheEntry>();

export function resetGaMetricsCache(): void {
  cache.clear();
  auth = null;
}

/**
 * GA4 audience metrics for one month, read from the Data API over plain REST —
 * the official `@google-analytics/data` client would pull gRPC into every App
 * Hosting cold start. Needs `GA_PROPERTY_ID` (numeric) plus a service account
 * in `GA_SERVICE_ACCOUNT_JSON` with read access to that property. Returns null
 * — never placeholder data — when the integration is unconfigured or the API
 * is unavailable, so the dashboard keeps rendering its "—" empty state.
 */
export async function loadGaMetrics(month?: string): Promise<GaMetrics | null> {
  const key = month ?? currentMonthKey();
  if (!parseMonthKey(key)) {
    logger.warn(WARNING, { reason: 'invalid month' });
    return null;
  }
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.metrics;
  const metrics = await reportOrNull(key);
  cache.set(key, { expiresAt: now + CACHE_MS, metrics });
  return metrics;
}

export function formatEngagement(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
