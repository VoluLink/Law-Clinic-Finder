import type { NextConfig } from 'next';

import { STATIC_SECURITY_HEADERS } from './src/lib/http/security-headers';

const nextConfig: NextConfig = {
  // Self-contained server build → runs on any host (Docker, VPS, all major clouds)
  output: 'standalone',
  // Hide the dev-only overlay indicator (the "N" mark, bottom-left in dev). It
  // never ships in a production build; this also removes it while running `next dev`.
  devIndicators: false,
  headers: () => [{ source: '/:path*', headers: [...STATIC_SECURITY_HEADERS] }],
};

export default nextConfig;
