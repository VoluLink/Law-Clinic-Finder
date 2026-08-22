import { z } from 'zod';

import { requestLoginLink } from '@/lib/auth/login-link';
import { clientIp } from '@/lib/http/client-ip';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';
import { LOGIN_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';

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
    return Response.json(
      { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
      { status: 429 },
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

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
