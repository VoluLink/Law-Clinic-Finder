import { z } from 'zod';

/** Client-supplied key; opaque, printable, and bounded. */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9_.:-]+$/);

export type IdempotencyRecord = { status: 'in_progress' | 'completed'; result: unknown };

export type IdempotencyStore = {
  /** Returns the existing record, or null when this call claimed the key. */
  claim(key: string, expiresAt: Date): Promise<IdempotencyRecord | null>;
  complete(key: string, result: unknown): Promise<void>;
  release(key: string): Promise<void>;
};

export type IdempotentOutcome<T> =
  | { status: 'executed'; result: T }
  | { status: 'replayed'; result: unknown }
  | { status: 'in_progress' };

/**
 * Runs `operation` at most once per key. A retried request replays the recorded
 * result instead of repeating the effect; a crash releases the claim so the
 * caller can try again.
 *
 * `shouldRecord` keeps a result that had no effect — a rejected configuration,
 * say — out of the record, so retrying the identical request re-runs it instead
 * of replaying a stale failure forever.
 */
export async function runIdempotent<T>(
  store: IdempotencyStore,
  key: string,
  expiresAt: Date,
  operation: () => Promise<T>,
  shouldRecord: (result: T) => boolean = () => true,
): Promise<IdempotentOutcome<T>> {
  const existing = await store.claim(key, expiresAt);
  if (existing?.status === 'completed') return { status: 'replayed', result: existing.result };
  if (existing) return { status: 'in_progress' };
  try {
    const result = await operation();
    if (shouldRecord(result)) await store.complete(key, result);
    else await store.release(key);
    return { status: 'executed', result };
  } catch (error) {
    await store.release(key);
    throw error;
  }
}
