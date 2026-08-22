export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimiter = {
  isLimited: (key: string, now?: number) => boolean;
};

export const CHAT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000,
};

const MS_PER_DAY = 86_400_000;

/** Signup endpoints: interactive search may be chatty; email sends are precious. */
export const SIGNUP_SEARCH_RATE_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };
export const SIGNUP_CLAIM_RATE_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: MS_PER_DAY };
export const SIGNUP_REGISTER_RATE_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: MS_PER_DAY };

/** Login links: generous enough for a mistyped address, tight enough that one
 *  address cannot drain the project-wide auth mail quota. */
export const LOGIN_RATE_LIMIT: RateLimitConfig = { maxRequests: 8, windowMs: 60 * 60_000 };
export const AUTH_CONFIRM_RATE_LIMIT: RateLimitConfig = { maxRequests: 20, windowMs: 60 * 60_000 };

/**
 * In-memory sliding-window limiter. Per-process only — behind multiple
 * instances, enforce limits at the proxy layer as well.
 */
export function createRateLimiter({ maxRequests, windowMs }: RateLimitConfig): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    isLimited(key, now = Date.now()) {
      const windowStart = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
      if (recent.length >= maxRequests) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      return false;
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
