import { isIP } from 'node:net';

/** Google App Hosting's load balancer appends client IP, then balancer IP. */
export function clientIp(request: Request): string {
  const addresses = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((address) => address.trim());
  if (!addresses || addresses.length < 2) return 'unknown';
  const client = addresses.at(-2) ?? '';
  const proxy = addresses.at(-1) ?? '';
  return isIP(client) && isIP(proxy) ? client : 'unknown';
}
