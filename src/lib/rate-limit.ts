export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  maxKeys?: number;
};

export type RateLimiter = {
  isLimited: (key: string, now?: number) => boolean;
};

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000,
};

const MS_PER_DAY = 86_400_000;
const DEFAULT_MAX_RATE_LIMIT_KEYS = 10_000;

/** Signup endpoints: interactive search may be chatty; email sends are precious. */
export const SIGNUP_SEARCH_RATE_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };
export const SIGNUP_CLAIM_RATE_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: MS_PER_DAY };
export const SIGNUP_REGISTER_RATE_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: MS_PER_DAY };

/** Login links: generous enough for a mistyped address, tight enough that one
 *  address cannot drain the project-wide auth mail quota. */
export const LOGIN_RATE_LIMIT: RateLimitConfig = { maxRequests: 8, windowMs: 60 * 60_000 };
export const AUTH_CONFIRM_RATE_LIMIT: RateLimitConfig = { maxRequests: 20, windowMs: 60 * 60_000 };

/** SMTP configuration changes: every attempt opens a real, authenticated SMTP
 *  connection, so an admin typo must not turn into an outbound scan. */
export const SMTP_SETTINGS_RATE_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60 * 60_000 };

/**
 * Re-inserting the key on every touch makes the Map's iteration order
 * least-recently-used, so the entry dropped under pressure is the one idle
 * longest. Evicting by first-insertion instead would discard exactly the
 * long-running abusive key the limiter exists to hold on to.
 */
function touch(hits: Map<string, number[]>, key: string, recent: number[], maxKeys: number): void {
  hits.delete(key);
  while (hits.size >= maxKeys) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  hits.set(key, recent);
}

/**
 * In-memory sliding-window limiter. Per-process only — behind multiple
 * instances, enforce limits at the proxy layer as well. `maxKeys` bounds memory
 * against a flood of distinct keys; it is availability protection, not a
 * substitute for a distributed limit.
 */
export function createRateLimiter({
  maxRequests,
  windowMs,
  maxKeys = DEFAULT_MAX_RATE_LIMIT_KEYS,
}: RateLimitConfig): RateLimiter {
  if (!Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new RangeError(`maxKeys must be a positive integer, received ${maxKeys}`);
  }
  const hits = new Map<string, number[]>();

  return {
    isLimited(key, now = Date.now()) {
      const windowStart = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
      const limited = recent.length >= maxRequests;
      if (!limited) recent.push(now);
      touch(hits, key, recent, maxKeys);
      return limited;
    },
  };
}

export type RateLimitScope = 'minute' | 'day';

export type ScopedRateLimiter = {
  check: (key: string, now?: number) => RateLimitScope | null;
};

/**
 * A request is limited when ANY limiter says so; `check` returns the blocking
 * scope so the client can show the right message ("wait a moment" vs "come
 * back tomorrow" — 'day' wins when both block). Every limiter is always
 * consulted (no short-circuit), so a burst blocked by the short window still
 * counts toward the longer windows.
 */
export function combineRateLimiters(
  ...entries: { scope: RateLimitScope; limiter: RateLimiter }[]
): ScopedRateLimiter {
  return {
    check(key, now) {
      const blocked = entries
        .filter((entry) => entry.limiter.isLimited(key, now))
        .map((entry) => entry.scope);
      if (blocked.includes('day')) return 'day';
      return blocked[0] ?? null;
    },
  };
}
