function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const exactOrigin = !url.username && !url.password && url.pathname === '/' && !url.search;
    return exactOrigin && !url.hash && (url.protocol === 'https:' || localHttp) ? url : null;
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    const source = parseOrigin(origin);
    if (!source) return false;
    const target = new URL(request.url);
    if (source.origin === target.origin && target.host === host) return true;
    const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
    return Boolean(configured && source.origin === parseOrigin(configured)?.origin);
  } catch {
    return false;
  }
}
