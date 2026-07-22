import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Logger } from '@/lib/logger';

export const clinicClickSchema = z.object({
  clinicId: z.uuid(),
  kind: z.enum(['click_website', 'click_email']),
});
export type ClinicClick = z.infer<typeof clinicClickSchema>;

export type ClickDeps = { adminClient: SupabaseClient; logger: Logger };

/**
 * Records a website/email click for the recommendation cards. Unknown or
 * unpublished clinics are ignored silently, so the public beacon can neither
 * probe the directory nor inflate counts for hidden rows. Stores no user data —
 * only the clinic, the kind, and a timestamp (the table default).
 */
export async function recordClinicClick(deps: ClickDeps, input: ClinicClick): Promise<void> {
  const { data: clinic } = await deps.adminClient
    .from('clinics')
    .select('id')
    .eq('id', input.clinicId)
    .eq('is_published', true)
    .maybeSingle();
  if (!clinic) return;
  const { error } = await deps.adminClient
    .from('clinic_events')
    .insert({ clinic_id: input.clinicId, kind: input.kind });
  if (error) deps.logger.warn('clinic click event insert failed', { reason: error.message });
}
