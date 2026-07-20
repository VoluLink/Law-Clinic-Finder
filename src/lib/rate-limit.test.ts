import { describe, expect, it } from 'vitest';

import {
  CHAT_DAILY_RATE_LIMIT,
  CHAT_RATE_LIMIT,
  combineRateLimiters,
  createRateLimiter,
} from './rate-limit';

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

  it('exports sensible chat defaults', () => {
    expect(CHAT_RATE_LIMIT.maxRequests).toBeGreaterThan(0);
    expect(CHAT_RATE_LIMIT.windowMs).toBeGreaterThan(0);
  });

  it('sizes the daily limit for two conversations of eight user turns', () => {
    expect(CHAT_DAILY_RATE_LIMIT.maxRequests).toBe(20);
    expect(CHAT_DAILY_RATE_LIMIT.windowMs).toBe(86_400_000);
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
