/**
 * When an unanswered registration or claim stops holding its reservations.
 *
 * A pending application reserves four things at once: the clinic name, the
 * e-mail address, the clinic's ownership slot and an Auth identity. Nothing
 * released them, so anyone could type a real law clinic's name into the public
 * signup form and make that name permanently unregisterable — and a published
 * clinic with no contact address on file could be locked out of its own entry.
 *
 * The decision is separated from the store because every rule here is a reason
 * NOT to delete someone's account, and those are worth testing on their own.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/** DECISION F: seven days is long enough for a forwarded invite to be answered. */
export const PENDING_APPLICATION_TTL_DAYS = 7;

export function pendingApplicationExpiry(now: Date): Date {
  return new Date(now.getTime() + PENDING_APPLICATION_TTL_DAYS * MS_PER_DAY);
}

export type PendingApplication = {
  clinicId: string;
  userId: string;
  /** 'pending' until an admin approves the application. */
  accessStatus: string;
  /** 'pending' for a self-registration; 'approved' for a claim on a live entry. */
  approvalStatus: string;
  expiresAt: Date | null;
  /** Firebase sets this when the invited person signs in through the link. */
  emailVerified: boolean;
  lastSignInAt: Date | null;
};

export type KeepReason = 'verified' | 'signed_in' | 'active' | 'not_due' | 'no_expiry';

export type ExpiryDecision =
  { action: 'expire'; removeClinic: boolean } | { action: 'keep'; reason: KeepReason };

/**
 * `removeClinic` distinguishes the two shapes a pending application can have.
 * A self-registration owns the clinic record it created, so the record and its
 * name reservation go with it. A claim was made against a clinic that already
 * existed and was approved, so only the ownership slot is released — deleting
 * the entry would remove a live directory listing over an unanswered e-mail.
 */
export function decideExpiry(application: PendingApplication, now: Date): ExpiryDecision {
  if (application.emailVerified) return { action: 'keep', reason: 'verified' };
  if (application.lastSignInAt !== null) return { action: 'keep', reason: 'signed_in' };
  if (application.accessStatus !== 'pending') return { action: 'keep', reason: 'active' };
  if (application.expiresAt === null) return { action: 'keep', reason: 'no_expiry' };
  if (application.expiresAt > now) return { action: 'keep', reason: 'not_due' };
  return { action: 'expire', removeClinic: application.approvalStatus === 'pending' };
}
