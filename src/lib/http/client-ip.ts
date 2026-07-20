/**
 * First entry of X-Forwarded-For. Only trustworthy when the fronting proxy
 * overwrites the header (deploy-time requirement, see README known gaps).
 */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
