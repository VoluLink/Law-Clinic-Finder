import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { DEFAULT_BRANDING, loadBranding, type Branding } from './branding';

/** Per-request branding for the root layout; degrades to defaults off-config. */
export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const supabase = await createSupabaseServerClient();
    return await loadBranding(supabase);
  } catch {
    return DEFAULT_BRANDING;
  }
});
