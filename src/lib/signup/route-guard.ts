import { clientIp } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import { logger } from '@/lib/logger';
import type { RateLimiter } from '@/lib/rate-limit';

/**
 * Shared gate for the public signup endpoints: config check → same-origin →
 * per-IP rate limit. Returns the rejection response, or null to proceed.
 */
export function guardSignupRequest(request: Request, limiter: RateLimiter): Response | null {
  if (!process.env.SUPABASE_SECRET_KEY) {
    logger.error('signup route missing SUPABASE_SECRET_KEY');
    return Response.json({ error: 'Derzeit nicht verfügbar.' }, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  }
  if (limiter.isLimited(clientIp(request))) {
    return Response.json(
      { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
      { status: 429 },
    );
  }
  return null;
}
