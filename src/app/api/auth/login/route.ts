import { z } from 'zod';

import { requestLoginLink } from '@/lib/auth/login-link';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { clientIp } from '@/lib/http/client-ip';
import { requestLogger } from '@/lib/http/request-id';
import type { Logger } from '@/lib/logger';
import { isSameOrigin } from '@/lib/http/same-origin';
import { tooManyRequests } from '@/lib/http/too-many-requests';
import { consumeDurableLimit } from '@/lib/firebase/durable-limit-store';
import { LOGIN_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { DURABLE_LOGIN_LIMIT } from '@/lib/security/abuse-window';

const limiter = createRateLimiter(LOGIN_RATE_LIMIT);
const loginSchema = z.object({ email: z.email() });

/**
 * Sends the magic link through the server-only Firebase/Brevo flow. Keeping the
 * Firebase web API out of this endpoint prevents client-side account creation
 * and gives every mail request the same abuse controls.
 *
 * Unknown addresses are identified explicitly by product decision. Exact-origin
 * validation and rate limiting still bound this intentional enumeration surface.
 */
export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  if (limiter.isLimited(clientIp(request))) {
    logger.warn('login link rate limited');
    return tooManyRequests();
  }
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = loginSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const durable = await durableLoginLimit(parsed.data.email, logger);
  if (durable) return durable;

  let status: 'sent' | 'not_registered' = 'sent';
  try {
    const result = await requestLoginLink(parsed.data.email);
    logger.info('login link request handled', { outcome: result.status });
    if (result.status === 'not_found') status = 'not_registered';
  } catch (error) {
    logger.error('login link delivery failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
  }
  return Response.json({ status });
}

/**
 * The per-IP limit above resets on every cold start, and mail is the expensive
 * side of this endpoint. This one counts per address in Firestore, so a single
 * mailbox cannot be used to drain the project's auth mail quota from a rotating
 * set of instances. It fails closed: sending the link needs Firestore anyway.
 */
async function durableLoginLimit(email: string, logger: Logger): Promise<Response | null> {
  try {
    const decision = await consumeDurableLimit('login', email, DURABLE_LOGIN_LIMIT);
    if (decision.allowed) return null;
    logger.warn('login link durably rate limited');
    return tooManyRequests(decision.retryAfterMs);
  } catch (error) {
    logger.error('durable login limit unavailable', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json({ error: 'Derzeit nicht verfügbar.' }, { status: 503 });
  }
}
