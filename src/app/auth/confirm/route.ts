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

const paramsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['email', 'magiclink', 'invite', 'email_change']),
});

type ConfirmProfile = {
  role?: string | null;
  clinic_id?: string | null;
  activated_at?: string | null;
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
  return profile.clinic_id;
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

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = paramsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) redirect('/login?error=1');
  const supabase = await createSupabaseServerClient();
  const { data: verified, error } = await supabase.auth.verifyOtp(parsed.data);
  if (error || !verified.user) redirect('/login?error=1');
  // Filter by user_id explicitly; RLS alone is not enough here — an admin can
  // read every profile row, so an unfiltered maybeSingle() errors on 2+ rows.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, clinic_id, activated_at')
    .eq('user_id', verified.user.id)
    .maybeSingle();
  const clinicId = autoPublishTarget(parsed.data.type, profile);
  if (clinicId && process.env.SUPABASE_SECRET_KEY) {
    const adminClient = createSupabaseAdminClient();
    const activated = await markAccessActivated(adminClient, verified.user.id);
    if (activated) await autoPublishClinic(adminClient, verified.user.id, clinicId);
  }
  redirect(profile?.role === 'admin' ? '/admin' : '/clinic');
}
