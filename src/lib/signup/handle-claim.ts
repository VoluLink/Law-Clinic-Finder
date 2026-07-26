import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { InviteResult } from '@/lib/admin/invite-clinic';
import type { Logger } from '@/lib/logger';

import { DIRECTORY_COLUMNS, toDirectoryMatch, type ClinicDirectoryRow } from './directory';

export const signupClaimSchema = z.object({ clinicId: z.uuid() });

const MS_PER_DAY = 86_400_000;
const CLAIM_WINDOW_MS = 7 * MS_PER_DAY;
/** Initial email + one immediate resend, then blocked for the rest of the window. */
const MAX_CLAIM_EMAILS_PER_WINDOW = 2;

export type ClaimDeps = {
  adminClient: SupabaseClient;
  logger: Logger;
  invite: (clinicId: string) => Promise<InviteResult>;
};

export type ClaimResult =
  | { status: 'sent'; maskedEmail: string }
  | { status: 'already_claimed' }
  | { status: 'no_email' }
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
  now = Date.now(),
): Promise<ClaimResult> {
  const { data } = await deps.adminClient
    .from('clinics')
    .select(DIRECTORY_COLUMNS)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) return { status: 'not_found' };
  const match = toDirectoryMatch(data as ClinicDirectoryRow);
  if (!match.maskedEmail) return { status: 'no_email' };

  const blocked = await resendBlock(deps, clinicId, now);
  if (blocked) return blocked;

  const invited = await deps.invite(clinicId);
  if (invited.status === 'already_invited') return { status: 'already_claimed' };
  if (invited.status !== 'ok') return { status: 'error' };

  const recorded = await deps.adminClient.from('claim_requests').insert({ clinic_id: clinicId });
  if (recorded.error) {
    deps.logger.warn('claim request not recorded', { clinicId, reason: recorded.error.message });
  }
  return { status: 'sent', maskedEmail: match.maskedEmail };
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
