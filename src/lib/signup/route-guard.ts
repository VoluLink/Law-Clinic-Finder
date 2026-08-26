import { clientIp, coarseIpKey } from '@/lib/http/client-ip';
import { isSameOrigin } from '@/lib/http/same-origin';
import { tooManyRequests } from '@/lib/http/too-many-requests';
import { consumeDurableLimits } from '@/lib/firebase/durable-limit-store';
import { firebaseConfig } from '@/lib/firebase/env';
import { logger, type Logger } from '@/lib/logger';
import type { RateLimiter } from '@/lib/rate-limit';
import { DURABLE_APPLICATION_LIMIT, DURABLE_NETWORK_LIMIT } from '@/lib/security/abuse-window';

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
  if (limiter.isLimited(clientIp(request))) return tooManyRequests();
  return null;
}

/**
 * The second, durable half of the signup gate, run once the body has been
 * parsed because the address it counts is in there. The in-process limit above
 * absorbs a flood cheaply; this one is what actually bounds how many identity
 * and name reservations one address or one network can start, across instances
 * and across deploys.
 *
 * Fails closed. Every signup path needs Firestore a moment later anyway, so a
 * limiter that could not read is not a reason to let the reservation through.
 */
export async function guardSignupSubject(
  request: Request,
  email: string | undefined,
  routeLogger: Logger = logger,
): Promise<Response | null> {
  const keys = [
    ...(email
      ? [{ scope: 'application' as const, subject: email, window: DURABLE_APPLICATION_LIMIT }]
      : []),
    {
      scope: 'network' as const,
      subject: coarseIpKey(clientIp(request)),
      window: DURABLE_NETWORK_LIMIT,
    },
  ];
  try {
    const decision = await consumeDurableLimits(keys);
    return decision.allowed ? null : tooManyRequests(decision.retryAfterMs);
  } catch (error) {
    routeLogger.error('durable signup limit unavailable', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json({ error: 'Derzeit nicht verfügbar.' }, { status: 503 });
  }
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
