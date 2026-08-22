const GOOGLE_ANALYTICS = [
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
] as const;

export const STATIC_SECURITY_HEADERS = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
] as const;

export function contentSecurityPolicy(nonce: string, development: boolean): string {
  const script = `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}`;
  const directives = [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
    `connect-src 'self' ${GOOGLE_ANALYTICS.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    development ? '' : 'upgrade-insecure-requests',
  ];
  return directives.filter(Boolean).join('; ');
}
