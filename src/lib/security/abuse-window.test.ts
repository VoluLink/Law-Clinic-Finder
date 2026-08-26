import { describe, expect, it } from 'vitest';

import { recordAttempt, windowExpiry, type AbuseWindow } from './abuse-window';

const WINDOW: AbuseWindow = { maxRequests: 3, windowMs: 60_000 };
const NOW = new Date('2026-08-26T12:00:00.000Z');

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe(recordAttempt, () => {
  it('allows the first attempt against an unseen subject', () => {
    expect(recordAttempt([], WINDOW, NOW)).toEqual({ allowed: true, hits: [NOW] });
  });

  it('allows attempts up to the configured maximum', () => {
    const stored = [at(-2_000), at(-1_000)];
    expect(recordAttempt(stored, WINDOW, NOW).allowed).toBe(true);
  });

  it('blocks the attempt that would exceed the maximum', () => {
    const stored = [at(-3_000), at(-2_000), at(-1_000)];
    expect(recordAttempt(stored, WINDOW, NOW).allowed).toBe(false);
  });

  it('reports how long the caller has to wait, measured from the oldest hit', () => {
    const stored = [at(-20_000), at(-2_000), at(-1_000)];
    const decision = recordAttempt(stored, WINDOW, NOW);
    expect(decision.allowed === false && decision.retryAfterMs).toBe(40_000);
  });

  it('lets the subject through again once the oldest hit falls out of the window', () => {
    const stored = [at(-60_001), at(-2_000), at(-1_000)];
    expect(recordAttempt(stored, WINDOW, NOW).allowed).toBe(true);
  });

  it('drops hits older than the window instead of storing them forever', () => {
    const decision = recordAttempt([at(-120_000), at(-1_000)], WINDOW, NOW);
    expect(decision.allowed === true && decision.hits).toEqual([at(-1_000), NOW]);
  });

  it('never stores more timestamps than the window allows', () => {
    const stored = [at(-4_000), at(-3_000), at(-2_000)];
    const decision = recordAttempt(stored, { ...WINDOW, maxRequests: 4 }, NOW);
    expect(decision.allowed === true && decision.hits).toHaveLength(4);
  });

  it('does not count a blocked attempt, so a flood cannot extend its own lockout', () => {
    const stored = [at(-3_000), at(-2_000), at(-1_000)];
    const first = recordAttempt(stored, WINDOW, NOW);
    const later = recordAttempt(stored, WINDOW, at(10_000));
    expect(first.allowed === false && later.allowed === false).toBe(true);
    expect(later.allowed === false && later.retryAfterMs).toBe(47_000);
  });

  it('tolerates timestamps arriving out of order', () => {
    const decision = recordAttempt([at(-1_000), at(-5_000)], WINDOW, NOW);
    expect(decision.allowed === true && decision.hits).toEqual([at(-5_000), at(-1_000), NOW]);
  });
});

describe(windowExpiry, () => {
  it('keeps the document one full window past its newest hit', () => {
    expect(windowExpiry([at(-30_000), NOW], WINDOW)).toEqual(at(60_000));
  });

  it('ignores the order the hits arrive in', () => {
    expect(windowExpiry([NOW, at(-30_000)], WINDOW)).toEqual(at(60_000));
  });

  it('rejects a hit list that cannot have come from an allowed decision', () => {
    expect(() => windowExpiry([], WINDOW)).toThrow(RangeError);
  });
});
