import { describe, expect, it } from 'vitest';

import {
  PENDING_APPLICATION_TTL_DAYS,
  decideExpiry,
  pendingApplicationExpiry,
  type PendingApplication,
} from './pending-expiry';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const LONG_AGO = new Date('2026-08-01T12:00:00.000Z');
const LATER = new Date('2026-09-01T12:00:00.000Z');

/** A self-registration nobody ever answered: due, and it owns its clinic record. */
const due: PendingApplication = {
  clinicId: 'ff000000-0000-0000-0000-000000000001',
  userId: 'user-1',
  accessStatus: 'pending',
  approvalStatus: 'pending',
  expiresAt: LONG_AGO,
  emailVerified: false,
  lastSignInAt: null,
};

describe(pendingApplicationExpiry, () => {
  it('falls due a week after the application is made', () => {
    const expiry = pendingApplicationExpiry(NOW);
    const days = (expiry.getTime() - NOW.getTime()) / (24 * 60 * 60 * 1_000);
    expect(days).toBe(PENDING_APPLICATION_TTL_DAYS);
  });
});

describe(decideExpiry, () => {
  it('expires an unanswered self-registration together with its clinic record', () => {
    expect(decideExpiry(due, NOW)).toEqual({ action: 'expire', removeClinic: true });
  });

  it('releases only the ownership slot when the claim was made against a live entry', () => {
    expect(decideExpiry({ ...due, approvalStatus: 'approved' }, NOW)).toEqual({
      action: 'expire',
      removeClinic: false,
    });
  });

  it('keeps an application whose address was confirmed', () => {
    expect(decideExpiry({ ...due, emailVerified: true }, NOW)).toEqual({
      action: 'keep',
      reason: 'verified',
    });
  });

  it('keeps an application whose owner has signed in, even unverified', () => {
    expect(decideExpiry({ ...due, lastSignInAt: LONG_AGO }, NOW)).toEqual({
      action: 'keep',
      reason: 'signed_in',
    });
  });

  it('keeps an application an admin has already approved', () => {
    expect(decideExpiry({ ...due, accessStatus: 'active' }, NOW)).toEqual({
      action: 'keep',
      reason: 'active',
    });
  });

  it('keeps an application that is not due yet', () => {
    expect(decideExpiry({ ...due, expiresAt: LATER }, NOW)).toEqual({
      action: 'keep',
      reason: 'not_due',
    });
  });

  it('keeps a record written before the lifecycle existed rather than guessing its age', () => {
    expect(decideExpiry({ ...due, expiresAt: null }, NOW)).toEqual({
      action: 'keep',
      reason: 'no_expiry',
    });
  });

  it('keeps an application that falls due in the same millisecond', () => {
    expect(decideExpiry({ ...due, expiresAt: NOW }, NOW)).toEqual({
      action: 'expire',
      removeClinic: true,
    });
  });

  it('prefers confirmation over every other signal', () => {
    const contradictory = { ...due, emailVerified: true, accessStatus: 'pending' as const };
    expect(decideExpiry(contradictory, LATER)).toEqual({ action: 'keep', reason: 'verified' });
  });
});
