/** The one wording and shape every rate-limited endpoint answers with. */
export const TOO_MANY_REQUESTS_MESSAGE = 'Zu viele Anfragen. Bitte versuche es später erneut.';

const MS_PER_SECOND = 1_000;

/**
 * `Retry-After` is sent only when the limit knows when it lifts. The in-process
 * limiter does not, and guessing would tell a caller to come back too early.
 */
export function tooManyRequests(retryAfterMs?: number): Response {
  const headers =
    retryAfterMs === undefined
      ? undefined
      : { 'retry-after': String(Math.ceil(retryAfterMs / MS_PER_SECOND)) };
  return Response.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429, headers });
}
