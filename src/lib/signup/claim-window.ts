const MS_PER_DAY = 86_400_000;
const CLAIM_WINDOW_MS = 7 * MS_PER_DAY;
const MAX_ATTEMPTS = 2;

type ClaimAttemptResult =
  { allowed: true; attempts: Date[] } | { allowed: false; retryDays: number };

export function reserveClaimAttempt(attempts: Date[], now: Date): ClaimAttemptResult {
  const recent = attempts
    .filter((attempt) => now.getTime() - attempt.getTime() < CLAIM_WINDOW_MS)
    .sort((left, right) => left.getTime() - right.getTime());
  if (recent.length < MAX_ATTEMPTS) return { allowed: true, attempts: [...recent, now] };
  const windowEndsAt = recent[0].getTime() + CLAIM_WINDOW_MS;
  const retryDays = Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / MS_PER_DAY));
  return { allowed: false, retryDays };
}

export function claimAttemptExpiry(now: Date): Date {
  return new Date(now.getTime() + CLAIM_WINDOW_MS);
}
