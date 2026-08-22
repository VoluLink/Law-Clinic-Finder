import { vi } from 'vitest';

import type { Logger } from '@/lib/logger';

export function testLogger(): Logger {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };
}
