import { headers } from 'next/headers';
import { cache } from 'react';

import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';
import { requestLogger } from '@/lib/http/request-id';

import { DEFAULT_BRANDING, loadBranding, type Branding } from './branding';

/** Per-request branding for the root layout; degrades to defaults off-config. */
export const getBranding = cache(async (): Promise<Branding> => {
  const logger = requestLogger({ headers: await headers() });
  try {
    return await loadBranding(firebaseBrandingRepository);
  } catch (error) {
    logger.warn('branding unavailable; using defaults', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return DEFAULT_BRANDING;
  }
});
