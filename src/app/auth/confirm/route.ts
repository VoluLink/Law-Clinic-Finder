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

type ConfirmProfile = { role?: string | null; clinic_id?: string | null } | null;

/**
 * The clinic to auto-publish, or null. Only the first invite acceptance counts:
 * that is the moment a clinic "registers with its email". Later magiclink logins
 * must never re-publish — otherwise an admin's "hide" would be silently undone.
 */
export function autoPublishTarget(type: string, profile: ConfirmProfile): string | null {
  if (type !== 'invite') return null;
  if (profile?.role !== 'clinic' || !profile.clinic_id) return null;
  return profile.clinic_id;
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
    logger.error('auto-publish on invite failed', { clinicId, reason: error.message });
    return false;
  }
  logger.info('clinic auto-published on invite acceptance', { clinicId, userId });
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
    .select('role, clinic_id')
    .eq('user_id', verified.user.id)
    .maybeSingle();
  const clinicId = autoPublishTarget(parsed.data.type, profile);
  if (clinicId && process.env.SUPABASE_SECRET_KEY) {
    await autoPublishClinic(createSupabaseAdminClient(), verified.user.id, clinicId);
  }
  redirect(profile?.role === 'admin' ? '/admin' : '/clinic');
}
