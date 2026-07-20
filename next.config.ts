import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server build → runs on any host (Docker, VPS, all major clouds)
  output: 'standalone',
};

export default nextConfig;
