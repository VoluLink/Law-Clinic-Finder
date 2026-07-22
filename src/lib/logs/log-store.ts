import type { SupabaseClient } from '@supabase/supabase-js';

import type { LogLine, WriteLine } from '@/lib/logger';

const RETENTION_DAYS = 7;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

export type LogStoreDeps = {
  client: SupabaseClient;
  /** Injectable clock — the prune throttle and cutoff read from it. */
  now?: () => number;
  retentionDays?: number;
  pruneIntervalMs?: number;
};

/**
 * Fire-and-forget sink that writes each log line into `public.logs` and, at
 * most once per interval, prunes rows past the retention window. Failures go to
 * stderr, never back through the logger, so a broken store can neither throw
 * into the request path nor recurse.
 */
export function createLogStore(deps: LogStoreDeps): { persist: WriteLine } {
  const now = deps.now ?? Date.now;
  const retentionDays = deps.retentionDays ?? RETENTION_DAYS;
  const pruneIntervalMs = deps.pruneIntervalMs ?? PRUNE_INTERVAL_MS;
  let lastPruneAt = 0;

  async function prune(): Promise<void> {
    const current = now();
    if (current - lastPruneAt < pruneIntervalMs) return;
    lastPruneAt = current;
    const cutoff = new Date(current - retentionDays * MS_PER_DAY).toISOString();
    const { error } = await deps.client.from('logs').delete().lt('logged_at', cutoff);
    if (error) throw new Error(error.message);
  }

  async function store({ timestamp, level, msg, ...fields }: LogLine): Promise<void> {
    const { error } = await deps.client
      .from('logs')
      .insert({ logged_at: timestamp, level, msg, fields: hasKeys(fields) ? fields : null });
    if (error) throw new Error(error.message);
    await prune();
  }

  return {
    persist: (line) =>
      void store(line).catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : 'unknown';
        process.stderr.write(`log store failed: ${reason}\n`);
      }),
  };
}

function hasKeys(record: Record<string, unknown>): boolean {
  return Object.keys(record).length > 0;
}
