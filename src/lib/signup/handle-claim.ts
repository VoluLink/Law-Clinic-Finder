import { z } from 'zod';

import type { InviteResult } from '@/lib/admin/invite-clinic';
import type { Logger } from '@/lib/logger';

import type { DirectoryMatch } from './directory';

export const signupClaimSchema = z.object({
  clinicId: z.uuid(),
  email: z.email().optional(),
});

type AttemptReservation = { allowed: true } | { allowed: false; retryDays: number };

export type ClinicClaimStore = {
  readMatch: (clinicId: string) => Promise<DirectoryMatch | null>;
  isEmailTaken: (email: string) => Promise<boolean>;
  reserveAttempt: (clinicId: string, now: Date) => Promise<AttemptReservation>;
};

export type ClaimDeps = {
  store: ClinicClaimStore;
  logger: Logger;
  invite: (clinicId: string) => Promise<InviteResult>;
  claimWithEmail: (clinicId: string, email: string) => Promise<InviteResult>;
};

export type ClaimResult =
  | { status: 'sent'; maskedEmail: string }
  | { status: 'pending_review'; email: string }
  | { status: 'already_claimed' }
  | { status: 'email_required' }
  | { status: 'email_taken' }
  | { status: 'blocked'; retryDays: number }
  | { status: 'not_found' }
  | { status: 'error' };

export async function claimClinic(
  deps: ClaimDeps,
  clinicId: string,
  email?: string,
  now = new Date(),
): Promise<ClaimResult> {
  try {
    return await executeClaim(deps, clinicId, email, now);
  } catch (error) {
    deps.logger.warn('clinic claim failed', { reason: errorMessage(error) });
    return { status: 'error' };
  }
}

async function executeClaim(
  deps: ClaimDeps,
  clinicId: string,
  email: string | undefined,
  now: Date,
): Promise<ClaimResult> {
  const match = await deps.store.readMatch(clinicId);
  if (!match) return { status: 'not_found' };
  if (match.maskedEmail) return claimOnFileAddress(deps, clinicId, match.maskedEmail, now);
  return claimSuppliedAddress(deps, match, email, now);
}

async function claimOnFileAddress(
  deps: ClaimDeps,
  clinicId: string,
  maskedEmail: string,
  now: Date,
): Promise<ClaimResult> {
  const blocked = await reserveOrBlock(deps.store, clinicId, now);
  if (blocked) return blocked;
  const result = await deps.invite(clinicId);
  if (result.status === 'already_invited') return { status: 'already_claimed' };
  if (result.status !== 'ok') return { status: 'error' };
  return { status: 'sent', maskedEmail };
}

async function claimSuppliedAddress(
  deps: ClaimDeps,
  match: DirectoryMatch,
  email: string | undefined,
  now: Date,
): Promise<ClaimResult> {
  if (!email) return { status: 'email_required' };
  if (match.claimed) return { status: 'already_claimed' };
  if (await deps.store.isEmailTaken(email)) return { status: 'email_taken' };
  const blocked = await reserveOrBlock(deps.store, match.id, now);
  if (blocked) return blocked;
  return createPendingClaim(deps, match.id, email);
}

async function createPendingClaim(
  deps: ClaimDeps,
  clinicId: string,
  email: string,
): Promise<ClaimResult> {
  const result = await deps.claimWithEmail(clinicId, email);
  if (result.status === 'already_invited') return { status: 'email_taken' };
  if (result.status !== 'ok') return { status: 'error' };
  deps.logger.info('clinic claim awaiting review', { clinicId });
  return { status: 'pending_review', email };
}

async function reserveOrBlock(
  store: ClinicClaimStore,
  clinicId: string,
  now: Date,
): Promise<ClaimResult | null> {
  const reservation = await store.reserveAttempt(clinicId, now);
  return reservation.allowed ? null : { status: 'blocked', retryDays: reservation.retryDays };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
