import { z } from 'zod';

import type { Logger } from '@/lib/logger';

export const clinicClickSchema = z.object({
  clinicId: z.uuid(),
  kind: z.enum(['click_website', 'click_email']),
});
export type ClinicClick = z.infer<typeof clinicClickSchema>;

export type ClinicClickStore = { recordClick: (input: ClinicClick) => Promise<boolean> };
export type ClickDeps = { store: ClinicClickStore; logger: Logger };

/**
 * Records a website/email click for the recommendation cards. Unknown or
 * unpublished clinics are ignored silently, so the public beacon can neither
 * probe the directory nor inflate counts for hidden rows. Stores no user data —
 * only the clinic, the kind, and a timestamp (the table default).
 */
export async function recordClinicClick(deps: ClickDeps, input: ClinicClick): Promise<void> {
  try {
    await deps.store.recordClick(input);
  } catch (error) {
    deps.logger.warn('clinic click event insert failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
