import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  publishBlockers,
  REQUIREMENT_COLUMNS,
  type ClinicRequirementFields,
} from '@/lib/clinics/publish-requirements';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const tokenSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['email', 'magiclink', 'invite', 'email_change']),
});
const codeSchema = z.object({ code: z.string().min(1) });

export type LinkFlow = 'token_hash' | 'code';

type ConfirmProfile = {
  role?: string | null;
  clinic_id?: string | null;
  activated_at?: string | null;
  access_status?: string | null;
} | null;

/**
 * The clinic to auto-publish, or null. The first invite or its replacement
 * magic link activates access. Later logins must never re-publish a clinic an
 * admin deliberately hid.
 */
export function autoPublishTarget(type: string, profile: ConfirmProfile): string | null {
  if (type !== 'invite' && type !== 'magiclink') return null;
  if (profile?.role !== 'clinic' || !profile.clinic_id) return null;
  if (profile.activated_at) return null;
  // A self-service claimant is unreviewed, and a database constraint forbids
  // publishing an unapproved entry — verifying an address must not go public.
  if (profile.access_status === 'pending') return null;
  return profile.clinic_id;
}

/**
 * Where a confirmed login lands. A verified user without a profile has no role
 * at all, so sending them to /clinic would only bounce off the proxy back to
 * /login; naming the reason is the difference between a loop and a message.
 */
export function destinationFor(profile: ConfirmProfile): string {
  if (!profile?.role) return '/login?error=no_access';
  if (profile.role === 'admin') return '/admin';
  return profile.access_status === 'pending' ? '/clinic/pending' : '/clinic';
}

export async function markAccessActivated(
  client: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const { error } = await client
    .from('profiles')
    .update({ activated_at: now.toISOString() })
    .eq('user_id', userId)
    .is('activated_at', null);
  if (!error) return true;
  logger.error('clinic access activation failed', { userId, reason: error.message });
  return false;
}

/** Publish the clinic if — and only if — its entry is already complete. */
export async function autoPublishClinic(
  client: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  clinicId: string,
): Promise<boolean> {
  const { data } = await client
    .from('clinics')
    .select(REQUIREMENT_COLUMNS)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data || publishBlockers(data as ClinicRequirementFields).length > 0) return false;
  const { error } = await client.from('clinics').update({ is_published: true }).eq('id', clinicId);
  if (error) {
    logger.error('auto-publish on access activation failed', { clinicId, reason: error.message });
    return false;
  }
  logger.info('clinic auto-published on first access activation', { clinicId, userId });
  return true;
}

type VerifiedLink = { userId: string; flow: LinkFlow; type: string };

/**
 * Both shapes an auth email can arrive in.
 *
 * `token_hash` comes from a template built on `{{ .TokenHash }}` and verifies on
 * any device. `code` is what Supabase's stock `{{ .ConfirmationURL }}` template
 * produces after its own /auth/v1/verify step; it completes the PKCE exchange,
 * but only in the browser that requested the link, because the code verifier
 * lives in a cookie there. That is why the stock template is accepted yet
 * flagged — it works, and it silently fails for anyone who opens the mail on
 * their phone.
 */
export async function verifyLink(
  supabase: SupabaseClient,
  params: Record<string, string>,
): Promise<VerifiedLink | null> {
  const token = tokenSchema.safeParse(params);
  if (token.success) {
    const { data, error } = await supabase.auth.verifyOtp(token.data);
    if (error || !data.user) {
      logger.warn('auth confirm failed', { reason: 'verify_failed', flow: 'token_hash' });
      return null;
    }
    return { userId: data.user.id, flow: 'token_hash', type: token.data.type };
  }

  const code = codeSchema.safeParse(params);
  if (!code.success) {
    logger.warn('auth confirm failed', { reason: 'missing_token' });
    return null;
  }
  logger.warn('auth email uses the stock Supabase template', {
    reason: 'confirmation_url_template',
    fix: 'set the template link to {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}',
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code.data.code);
  if (error || !data.user) {
    logger.warn('auth confirm failed', { reason: 'exchange_failed', flow: 'code' });
    return null;
  }
  // The stock link carries no type. Treating it as a magic link keeps the
  // one-time activation behaviour identical across both flows.
  return { userId: data.user.id, flow: 'code', type: 'magiclink' };
}

export async function GET(request: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const link = await verifyLink(supabase, params);
  if (!link) redirect('/login?error=1');
  // Filter by user_id explicitly; RLS alone is not enough here — an admin can
  // read every profile row, so an unfiltered maybeSingle() errors on 2+ rows.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, clinic_id, activated_at, access_status')
    .eq('user_id', link.userId)
    .maybeSingle();
  const clinicId = autoPublishTarget(link.type, profile);
  if (clinicId && process.env.SUPABASE_SECRET_KEY) {
    const adminClient = createSupabaseAdminClient();
    const activated = await markAccessActivated(adminClient, link.userId);
    if (activated) await autoPublishClinic(adminClient, link.userId, clinicId);
  }
  const destination = destinationFor(profile);
  logger.info('auth confirm succeeded', {
    userId: link.userId,
    role: profile?.role ?? null,
    flow: link.flow,
    destination,
  });
  redirect(destination);
}
