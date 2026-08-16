import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom performs no layout, so scrollIntoView is missing from Element entirely.
Element.prototype.scrollIntoView = vi.fn();

// Auth emails need an absolute /auth/confirm URL. Production pins it with this
// variable, so tests take the same branch; the request-header fallback is
// covered directly in auth-redirect.test.ts, where headers() is mocked.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
