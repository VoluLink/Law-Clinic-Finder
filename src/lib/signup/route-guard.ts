import { clientIp } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import { firebaseConfig } from '@/lib/firebase/env';
import { logger, type Logger } from '@/lib/logger';
import type { RateLimiter } from '@/lib/rate-limit';

/**
 * Shared gate for the public signup endpoints: config check → same-origin →
 * per-IP rate limit. Returns the rejection response, or null to proceed.
 */
export function guardSignupRequest(
  request: Request,
  limiter: RateLimiter,
  routeLogger: Logger = logger,
): Response | null {
  if (!hasFirebaseConfig(routeLogger)) {
    return Response.json({ error: 'Derzeit nicht verfügbar.' }, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  }
  if (limiter.isLimited(clientIp(request))) {
    return Response.json(
      { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  return null;
}

function hasFirebaseConfig(routeLogger: Logger): boolean {
  try {
    firebaseConfig();
    return true;
  } catch {
    routeLogger.error('signup route missing Firebase configuration');
    return false;
  }
}
