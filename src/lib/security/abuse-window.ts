/**
 * The sliding window behind the durable abuse limits.
 *
 * The in-process limiter in `src/lib/rate-limit.ts` is a Map, so it resets on
 * every deploy and every cold start, and two App Hosting instances never see
 * each other's counts. That is fine as a cheap flood guard and useless as a
 * limit on anything that costs money or sends mail. This is the same idea with
 * the state in Firestore, so it is kept separate: the decision is pure, the
 * store only reads and writes what this returns.
 */

export type AbuseWindow = {
  /** Attempts allowed inside the window. */
  maxRequests: number;
  windowMs: number;
};

export type WindowDecision =
  { allowed: true; hits: Date[] } | { allowed: false; retryAfterMs: number };

/** Login links: an address may be asked for eight times a day, not per instance. */
export const DURABLE_LOGIN_LIMIT: AbuseWindow = { maxRequests: 8, windowMs: 24 * 60 * 60 * 1_000 };

/** One address may start three applications a day; one network, twelve. */
export const DURABLE_APPLICATION_LIMIT: AbuseWindow = {
  maxRequests: 3,
  windowMs: 24 * 60 * 60 * 1_000,
};
export const DURABLE_NETWORK_LIMIT: AbuseWindow = {
  maxRequests: 12,
  windowMs: 24 * 60 * 60 * 1_000,
};

function withinWindow(hits: Date[], window: AbuseWindow, now: Date): Date[] {
  const cutoff = now.getTime() - window.windowMs;
  return hits.filter((hit) => hit.getTime() > cutoff).sort((a, b) => a.getTime() - b.getTime());
}

/**
 * A blocked attempt is deliberately not recorded. Counting rejections would let
 * a flood extend its own lockout indefinitely, and the caller has already paid
 * the in-process limiter for the flood itself.
 */
export function recordAttempt(stored: Date[], window: AbuseWindow, now: Date): WindowDecision {
  const recent = withinWindow(stored, window, now);
  if (recent.length < window.maxRequests) {
    return { allowed: true, hits: [...recent, now].slice(-window.maxRequests) };
  }
  const oldest = recent[0].getTime();
  return { allowed: false, retryAfterMs: Math.max(0, oldest + window.windowMs - now.getTime()) };
}

/**
 * When the document may be dropped: one full window after its newest hit. The
 * caller passes the hit list an allowed decision returned, which always ends
 * with the attempt just recorded, so an empty list means a caller bug.
 */
export function windowExpiry(hits: Date[], window: AbuseWindow): Date {
  const newest = hits.reduce((latest, hit) => Math.max(latest, hit.getTime()), 0);
  if (newest === 0) throw new RangeError('a window with no hits has nothing to expire');
  return new Date(newest + window.windowMs);
}
