import type { NextRequest } from 'next/server';

import { clinicClickSchema, recordClinicClick } from '@/lib/clinics/click-event';
import { firebaseClinicClickStore } from '@/lib/firebase/clinic-events';
import { clientIp } from '@/lib/http/client-ip';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';
import { createRateLimiter } from '@/lib/rate-limit';

// Public beacon fired by the recommendation cards when a user opens a clinic's
// website or email. Unauthenticated by design, so it is same-origin gated and
// per-IP rate limited; the recorder itself only counts clicks for published
// clinics and stores no user data.
const limiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (limiter.isLimited(clientIp(request))) return new Response(null, { status: 429 });
  const parsed = clinicClickSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  await recordClinicClick({ store: firebaseClinicClickStore, logger }, parsed.data);
  return new Response(null, { status: 204 });
}
