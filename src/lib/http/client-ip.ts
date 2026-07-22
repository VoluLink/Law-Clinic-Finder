/**
 * First entry of X-Forwarded-For. A client can send this header itself, so the
 * value is only trustworthy when the fronting proxy overwrites it — a
 * deploy-time requirement, without which the per-IP rate limits are forgeable.
 */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
