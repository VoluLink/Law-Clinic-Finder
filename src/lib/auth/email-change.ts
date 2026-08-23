import { z } from 'zod';

import type { EmailStateRecord } from './email-state';
import { recentlyAuthenticated } from './recent-auth';

const CHANGE_TTL_MS = 15 * 60 * 1_000;

const requestSchema = z.object({
  userId: z.string().min(1).max(128),
  currentEmail: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  newEmail: z
    .email()
    .max(200)
    .transform((email) => email.toLowerCase()),
  authTime: z.number().int().nonnegative(),
});

type EmailChangeInput = z.input<typeof requestSchema>;
type ReservationResult = 'ok' | 'email_taken';

export type EmailChangeRequestDependencies = {
  reserve(
    userId: string,
    currentEmail: string,
    newEmail: string,
    expiresAt: Date,
  ): Promise<ReservationResult>;
  release(userId: string, newEmail: string): Promise<void>;
  sendVerification(userId: string, currentEmail: string, newEmail: string): Promise<void>;
};

export type EmailChangeRequestResult =
  | { status: 'sent' }
  | { status: 'reauth_required' }
  | { status: 'same_email' }
  | { status: 'email_taken' }
  | { status: 'error' };

export async function requestEmailChange(
  dependencies: EmailChangeRequestDependencies,
  input: EmailChangeInput,
  now = new Date(),
): Promise<EmailChangeRequestResult> {
  const request = requestSchema.parse(input);
  if (!recentlyAuthenticated(request.authTime, now)) return { status: 'reauth_required' };
  if (request.currentEmail === request.newEmail) return { status: 'same_email' };
  const expiresAt = new Date(now.getTime() + CHANGE_TTL_MS);
  const reserved = await dependencies.reserve(
    request.userId,
    request.currentEmail,
    request.newEmail,
    expiresAt,
  );
  if (reserved !== 'ok') return { status: reserved };
  return sendReservedChange(dependencies, request.userId, request.currentEmail, request.newEmail);
}

async function sendReservedChange(
  dependencies: EmailChangeRequestDependencies,
  userId: string,
  currentEmail: string,
  newEmail: string,
): Promise<EmailChangeRequestResult> {
  try {
    await dependencies.sendVerification(userId, currentEmail, newEmail);
    return { status: 'sent' };
  } catch {
    await dependencies.release(userId, newEmail);
    return { status: 'error' };
  }
}

type AppliedChange = { userId: string; email: string };

export type EmailChangeCompletionDependencies = {
  lookup(state: string, actionCode: string): Promise<EmailStateRecord | null>;
  consume(state: string, actionCode: string): Promise<EmailStateRecord | null>;
  readAuthEmail(userId: string): Promise<string | null>;
  applyActionCode(actionCode: string): Promise<AppliedChange>;
  finalize(userId: string, newEmail: string): Promise<void>;
  revokeSessions(userId: string): Promise<void>;
};

export async function completeEmailChange(
  state: string,
  actionCode: string,
  dependencies: EmailChangeCompletionDependencies,
): Promise<{ ok: boolean }> {
  const record = await dependencies.lookup(state, actionCode);
  if (!record || record.purpose !== 'email_change') return { ok: false };
  const changed = await ensureAuthEmail(record, actionCode, dependencies);
  if (!changed) return { ok: false };
  await dependencies.finalize(record.userId, record.email);
  await dependencies.revokeSessions(record.userId);
  await dependencies.consume(state, actionCode);
  return { ok: true };
}

async function ensureAuthEmail(
  record: EmailStateRecord,
  actionCode: string,
  dependencies: EmailChangeCompletionDependencies,
): Promise<boolean> {
  if (sameEmail(await dependencies.readAuthEmail(record.userId), record.email)) return true;
  try {
    const applied = await dependencies.applyActionCode(actionCode);
    return applied.userId === record.userId && sameEmail(applied.email, record.email);
  } catch (error) {
    if (sameEmail(await dependencies.readAuthEmail(record.userId), record.email)) return true;
    throw error;
  }
}

function sameEmail(left: string | null, right: string): boolean {
  return left?.toLowerCase() === right.toLowerCase();
}
