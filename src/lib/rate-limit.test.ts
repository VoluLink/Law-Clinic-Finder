import { describe, expect, it } from 'vitest';

import { CHAT_RATE_LIMIT, combineRateLimiters, createRateLimiter } from './rate-limit';

const START = 1_000_000;

describe('createRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    expect(limiter.isLimited('ip-1', START)).toBe(false);
    expect(limiter.isLimited('ip-1', START + 1)).toBe(false);
    expect(limiter.isLimited('ip-1', START + 2)).toBe(false);
  });

  it('blocks the request that exceeds the limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.isLimited('ip-1', START);
    limiter.isLimited('ip-1', START + 1);
    expect(limiter.isLimited('ip-1', START + 2)).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.isLimited('ip-1', START);
    expect(limiter.isLimited('ip-2', START)).toBe(false);
  });

  it('allows again after the window has passed', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.isLimited('ip-1', START);
    expect(limiter.isLimited('ip-1', START + 60_001)).toBe(false);
  });

  it('bounds the number of tracked keys', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.isLimited('ip-1', START);
    limiter.isLimited('ip-2', START);
    limiter.isLimited('ip-3', START);
    expect(limiter.isLimited('ip-1', START + 1)).toBe(false);
  });

  it('evicts the least recently used key rather than the first one seen', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000, maxKeys: 2 });
    limiter.isLimited('ip-1', START);
    limiter.isLimited('ip-2', START);
    limiter.isLimited('ip-1', START + 1);
    limiter.isLimited('ip-3', START + 2);
    expect(limiter.isLimited('ip-1', START + 3)).toBe(true);
  });

  it('counts a blocked request as recent use, so the abusive key survives', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.isLimited('ip-1', START);
    limiter.isLimited('ip-2', START + 1);
    limiter.isLimited('ip-1', START + 2);
    limiter.isLimited('ip-3', START + 3);
    expect(limiter.isLimited('ip-1', START + 4)).toBe(true);
  });

  it('rejects a limiter that cannot track a single key', () => {
    expect(() => createRateLimiter({ maxRequests: 1, windowMs: 60_000, maxKeys: 0 })).toThrow(
      RangeError,
    );
  });

  it('exports sensible chat defaults', () => {
    expect(CHAT_RATE_LIMIT.maxRequests).toBeGreaterThan(0);
    expect(CHAT_RATE_LIMIT.windowMs).toBeGreaterThan(0);
  });
});

describe(combineRateLimiters, () => {
  it('reports the scope of the limiter that blocks', () => {
    const combined = combineRateLimiters(
      { scope: 'minute', limiter: createRateLimiter({ maxRequests: 1, windowMs: 60_000 }) },
      { scope: 'day', limiter: createRateLimiter({ maxRequests: 100, windowMs: 86_400_000 }) },
    );
    expect(combined.check('ip-1', START)).toBeNull();
    expect(combined.check('ip-1', START + 1)).toBe('minute');
  });

  it('counts allowed requests toward every limiter', () => {
    const combined = combineRateLimiters(
      { scope: 'minute', limiter: createRateLimiter({ maxRequests: 100, windowMs: 1_000 }) },
      { scope: 'day', limiter: createRateLimiter({ maxRequests: 2, windowMs: 86_400_000 }) },
    );
    expect(combined.check('ip-1', START)).toBeNull();
    expect(combined.check('ip-1', START + 5_000)).toBeNull();
    expect(combined.check('ip-1', START + 10_000)).toBe('day');
  });

  it('prefers the day scope when both windows block', () => {
    const combined = combineRateLimiters(
      { scope: 'minute', limiter: createRateLimiter({ maxRequests: 1, windowMs: 60_000 }) },
      { scope: 'day', limiter: createRateLimiter({ maxRequests: 1, windowMs: 86_400_000 }) },
    );
    combined.check('ip-1', START);
    expect(combined.check('ip-1', START + 1)).toBe('day');
  });
});
