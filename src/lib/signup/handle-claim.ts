import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { InviteResult } from '@/lib/admin/invite-clinic';
import type { Logger } from '@/lib/logger';

import { DIRECTORY_COLUMNS, toDirectoryMatch, type ClinicDirectoryRow } from './directory';

export const signupClaimSchema = z.object({
  clinicId: z.uuid(),
  /** Only for entries with no address on file; the claimant supplies their own. */
  email: z.email().optional(),
});

const MS_PER_DAY = 86_400_000;
const CLAIM_WINDOW_MS = 7 * MS_PER_DAY;
/** Initial email + one immediate resend, then blocked for the rest of the window. */
const MAX_CLAIM_EMAILS_PER_WINDOW = 2;

export type ClaimDeps = {
  adminClient: SupabaseClient;
  logger: Logger;
  invite: (clinicId: string) => Promise<InviteResult>;
  /** Option 2: invites a self-supplied address and leaves access pending. */
  claimWithEmail: (clinicId: string, email: string) => Promise<InviteResult>;
  isEmailTaken: (email: string) => Promise<boolean>;
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

/**
 * Self-service claim: sends the access invite to the address already on file,
 * so the emailed link is itself the ownership check — only whoever can read
 * that inbox takes control. The caller supplies `invite` (production:
 * `reinviteClinic`).
 */
export async function claimClinic(
  deps: ClaimDeps,
  clinicId: string,
  email?: string,
  now = Date.now(),
): Promise<ClaimResult> {
  const { data } = await deps.adminClient
    .from('clinics')
    .select(DIRECTORY_COLUMNS)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) return { status: 'not_found' };
  const match = toDirectoryMatch(data as ClinicDirectoryRow);

  const blocked = await resendBlock(deps, clinicId, now);
  if (blocked) return blocked;

  const result = match.maskedEmail
    ? await claimOnFileAddress(deps, clinicId, match.maskedEmail)
    : await claimSuppliedAddress(deps, clinicId, match.claimed, email);
  if (result.status === 'sent' || result.status === 'pending_review') {
    await recordClaim(deps, clinicId);
  }
  return result;
}

/** Option 1: the address is already on file, so the emailed link is the proof. */
async function claimOnFileAddress(
  deps: ClaimDeps,
  clinicId: string,
  maskedEmail: string,
): Promise<ClaimResult> {
  const invited = await deps.invite(clinicId);
  if (invited.status === 'already_invited') return { status: 'already_claimed' };
  if (invited.status !== 'ok') return { status: 'error' };
  return { status: 'sent', maskedEmail };
}

/**
 * Option 2: no address on file, so the claimant supplies one. Verifying it only
 * proves they read that inbox — not that the clinic is theirs — so access stays
 * pending until an admin approves. The existing UNIQUE profiles.clinic_id keeps
 * the slot to a single claimant while that decision is open.
 */
async function claimSuppliedAddress(
  deps: ClaimDeps,
  clinicId: string,
  claimed: boolean,
  email?: string,
): Promise<ClaimResult> {
  if (!email) return { status: 'email_required' };
  if (claimed) return { status: 'already_claimed' };
  if (await deps.isEmailTaken(email)) return { status: 'email_taken' };

  const invited = await deps.claimWithEmail(clinicId, email);
  if (invited.status === 'already_invited') return { status: 'email_taken' };
  if (invited.status !== 'ok') return { status: 'error' };

  const saved = await deps.adminClient
    .from('clinics')
    .update({ contact_email: email })
    .eq('id', clinicId);
  if (saved.error) {
    deps.logger.error('claim email not stored', { clinicId, reason: saved.error.message });
  }
  deps.logger.info('clinic claim awaiting review', { clinicId });
  return { status: 'pending_review', email };
}

async function recordClaim(deps: ClaimDeps, clinicId: string): Promise<void> {
  const recorded = await deps.adminClient.from('claim_requests').insert({ clinic_id: clinicId });
  if (recorded.error) {
    deps.logger.warn('claim request not recorded', { clinicId, reason: recorded.error.message });
  }
}

async function resendBlock(
  deps: ClaimDeps,
  clinicId: string,
  now: number,
): Promise<ClaimResult | null> {
  const since = new Date(now - CLAIM_WINDOW_MS).toISOString();
  const { data, error } = await deps.adminClient
    .from('claim_requests')
    .select('sent_at')
    .eq('clinic_id', clinicId)
    .gte('sent_at', since)
    .order('sent_at', { ascending: true });
  if (error) {
    deps.logger.warn('claim window lookup failed', { clinicId, reason: error.message });
    return { status: 'error' };
  }
  const sends = (data ?? []) as { sent_at: string }[];
  if (sends.length < MAX_CLAIM_EMAILS_PER_WINDOW) return null;
  const windowEnds = new Date(sends[0].sent_at).getTime() + CLAIM_WINDOW_MS;
  const retryDays = Math.max(1, Math.ceil((windowEnds - now) / MS_PER_DAY));
  return { status: 'blocked', retryDays };
}
