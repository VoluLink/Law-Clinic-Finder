/** Window in which a sensitive change may follow a sign-in without a new one. */
export const RECENT_AUTH_SECONDS = 5 * 60;

/**
 * `authTime` is the seconds-since-epoch claim of the verified session. A future
 * timestamp is rejected rather than trusted, so a skewed or forged claim cannot
 * widen the window.
 */
export function recentlyAuthenticated(authTime: number, now: Date = new Date()): boolean {
  const age = Math.floor(now.getTime() / 1_000) - authTime;
  return age >= 0 && age <= RECENT_AUTH_SECONDS;
}
