import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // 'server-only' throws on import outside a React Server Component, which
      // would fail every suite that reaches a server module. The guard is a
      // build-time contract, so stubbing it here costs no coverage.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    // globals enables @testing-library/react auto-cleanup between tests
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
});
