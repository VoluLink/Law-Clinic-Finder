import { isIP } from 'node:net';

/*
 * Which header carries the real client address depends on what sits in front of
 * the app, and getting it wrong makes every per-IP limit forgeable — a client can
 * set any header it likes. So the trusted source is chosen explicitly by
 * configuration rather than sniffed from the request.
 *
 * Default: Google App Hosting's load balancer appends the client IP, then its own,
 * so the penultimate entry of `x-forwarded-for` is the client and the last entry
 * must itself be an IP. Anything a client prepends is ignored.
 *
 * `TRUSTED_PROXY=cloudflare`: Cloudflare replaces `CF-Connecting-IP` on every
 * proxied request, so it is authoritative — but only once the origin is locked
 * down to Cloudflare, otherwise anyone can reach the origin directly and spoof it.
 */
const UNKNOWN = 'unknown';

function cloudflareIp(request: Request): string {
  const address = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  return isIP(address) ? address : UNKNOWN;
}

function forwardedForIp(request: Request): string {
  const addresses = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((address) => address.trim());
  if (!addresses || addresses.length < 2) return UNKNOWN;
  const client = addresses.at(-2) ?? '';
  const proxy = addresses.at(-1) ?? '';
  return isIP(client) && isIP(proxy) ? client : UNKNOWN;
}

export function clientIp(request: Request): string {
  return process.env.TRUSTED_PROXY === 'cloudflare'
    ? cloudflareIp(request)
    : forwardedForIp(request);
}
