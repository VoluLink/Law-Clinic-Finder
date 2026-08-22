import 'server-only';

import { z } from 'zod';

import type { DailyQuotaStore } from './daily-quota-store';

const QUOTA_COOKIE = 'lcf_chat_quota';
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

const quotaResponseSchema = z.union([
  z.object({
    allowed: z.literal(true),
    scope: z.null(),
    resetAt: z.iso.datetime({ offset: true }),
  }),
  z.object({
    allowed: z.literal(false),
    scope: z.literal('day'),
    resetAt: z.iso.datetime({ offset: true }),
  }),
]);

export type DailyQuotaDeps = {
  store: DailyQuotaStore;
  createToken?: () => string;
  digestToken?: (token: string) => Promise<string>;
  now?: () => Date;
};

export type DailyQuotaClaim =
  | { ok: false; reason: string }
  | {
      ok: true;
      allowed: boolean;
      scope: 'day' | null;
      resetAt: string;
      setCookie?: string;
    };

export async function claimDailyChatQuota(
  deps: DailyQuotaDeps,
  request: Request,
  sessionId: string,
): Promise<DailyQuotaClaim> {
  try {
    return await claimQuotaRecord(deps, request, sessionId);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'quota request failed' };
  }
}

async function claimQuotaRecord(
  deps: DailyQuotaDeps,
  request: Request,
  sessionId: string,
): Promise<DailyQuotaClaim> {
  const existingToken = readQuotaToken(request.headers.get('cookie'));
  const token = existingToken ?? (deps.createToken ?? createOpaqueToken)();
  const digestToken = deps.digestToken ?? sha256Hex;
  const deviceHash = await digestToken(token);
  const data = await deps.store.claim(deviceHash, sessionId, deps.now?.() ?? new Date());
  const parsed = quotaResponseSchema.safeParse({
    ...data,
    scope: data.allowed ? null : 'day',
  });
  if (!parsed.success) return { ok: false, reason: 'invalid quota response' };
  const setCookie = existingToken
    ? undefined
    : quotaCookie(token, parsed.data.resetAt, deps.now?.());
  return { ok: true, ...parsed.data, setCookie };
}

function readQuotaToken(cookieHeader: string | null): string | null {
  const entry = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${QUOTA_COOKIE}=`));
  const token = entry?.slice(QUOTA_COOKIE.length + 1) ?? '';
  return TOKEN_PATTERN.test(token) ? token : null;
}

function createOpaqueToken(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

async function sha256Hex(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function quotaCookie(token: string, resetAt: string, now = new Date()): string {
  const expires = new Date(resetAt);
  const maxAge = Math.max(1, Math.floor((expires.getTime() - now.getTime()) / 1000));
  const parts = [
    `${QUOTA_COOKIE}=${token}`,
    'Path=/api/chat',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    `Expires=${expires.toUTCString()}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
