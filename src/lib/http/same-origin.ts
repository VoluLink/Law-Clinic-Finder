/**
 * Browsers send an Origin header on every POST; requiring it to match the Host
 * header stops other sites and naive scripts from using our public endpoints
 * as a free API. Forged headers get past this — the rate limiters cap those.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
