import { vi } from 'vitest';

import type { Logger } from '@/lib/logger';

export type CallLog = Array<[string, unknown[]]>;
export type QueryResult = { data: unknown; error: { message: string } | null };

const QUERY_METHODS = ['select', 'eq', 'ilike', 'gte', 'order', 'limit', 'insert', 'delete'];

/**
 * Minimal chainable stand-in for the Supabase query builder. Each `from()`
 * call consumes the next queued result (thenable / maybeSingle at the end).
 */
export function createAdminClientMock(responses: QueryResult[]) {
  const calls: CallLog = [];
  let index = 0;
  const client = {
    from: (table: string) => {
      calls.push(['from', [table]]);
      const result = responses[index++] ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const method of QUERY_METHODS) {
        query[method] = (...args: unknown[]) => {
          calls.push([method, args]);
          return query;
        };
      }
      query.maybeSingle = () => Promise.resolve(result);
      query.single = () => Promise.resolve(result);
      (query as { then: unknown }).then = (resolve: (value: unknown) => void) => resolve(result);
      return query;
    },
  };
  return { client, calls };
}

export function testLogger(): Logger {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };
}
