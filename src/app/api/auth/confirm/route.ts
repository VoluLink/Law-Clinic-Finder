import { confirmAuthPayload, type ConfirmationResult } from '@/lib/auth/confirm-link';
import { confirmationPayloadSchema } from '@/lib/auth/confirmation-payload';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { clientIp } from '@/lib/http/client-ip';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';
import type { Logger } from '@/lib/logger';
import { AUTH_CONFIRM_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';

const limiter = createRateLimiter(AUTH_CONFIRM_RATE_LIMIT);

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function logResult(result: ConfirmationResult, logger: Logger): void {
  if (result.outcome === 'succeeded') {
    logger.info('auth confirm succeeded');
    return;
  }
  logger.warn('auth confirm rejected', {
    outcome: result.outcome,
    ...(result.reason ? { reason: result.reason } : {}),
  });
}

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Nicht erlaubt.' }, 403);
  if (limiter.isLimited(clientIp(request))) {
    logger.warn('auth confirmation rate limited');
    return jsonResponse({ error: 'Zu viele Anfragen.' }, 429);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const payload = confirmationPayloadSchema.safeParse(body.value);
  if (!payload.success) return jsonResponse({ error: 'Ungültige Anfrage.' }, 400);
  const result = await confirmAuthPayload(payload.data);
  logResult(result, logger);
  return jsonResponse({ destination: result.destination });
}
