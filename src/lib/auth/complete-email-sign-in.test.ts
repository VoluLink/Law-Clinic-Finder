import { describe, expect, it, vi } from 'vitest';

import type { EmailStateRecord } from './email-state';
import { completeEmailSignIn, destinationFor } from './complete-email-sign-in';

const record: EmailStateRecord = {
  email: 'clinic@example.org',
  userId: 'user-1',
  purpose: 'invite',
  codeHash: 'a'.repeat(64),
  createdAt: new Date('2026-08-16T10:00:00.000Z'),
  expiresAt: new Date('2026-08-16T10:15:00.000Z'),
};

const profile = {
  role: 'clinic' as const,
  clinic_id: '11111111-1111-4111-8111-111111111111',
  access_status: 'active' as const,
  activated_at: null,
};

function dependencies() {
  return {
    consumeState: vi.fn().mockResolvedValue(record),
    exchange: vi.fn().mockResolvedValue({
      idToken: 'firebase-id-token',
      userId: record.userId,
      email: record.email,
    }),
    readProfile: vi.fn().mockResolvedValue(profile),
    activateFirstAccess: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe(completeEmailSignIn, () => {
  it('consumes the bound state before creating a server session', async () => {
    const deps = dependencies();
    await expect(completeEmailSignIn('state', 'action-code', deps)).resolves.toMatchObject({
      ok: true,
      destination: '/clinic',
    });
    expect(deps.createSession).toHaveBeenCalledWith('firebase-id-token');
  });

  it('activates first access for an approved clinic account', async () => {
    const deps = dependencies();
    await completeEmailSignIn('state', 'action-code', deps);
    expect(deps.activateFirstAccess).toHaveBeenCalledWith(record.userId);
  });

  it('rejects an action code whose Firebase identity differs from the state', async () => {
    const deps = dependencies();
    deps.exchange.mockResolvedValue({
      idToken: 'token',
      userId: 'different-user',
      email: record.email,
    });
    expect(await completeEmailSignIn('state', 'action-code', deps)).toEqual({
      ok: false,
      reason: 'identity_mismatch',
    });
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it('does not create a session for an Auth identity without a profile', async () => {
    const deps = dependencies();
    deps.readProfile.mockResolvedValue(null);
    expect(await completeEmailSignIn('state', 'action-code', deps)).toEqual({
      ok: false,
      reason: 'no_access',
    });
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it('rejects a missing, expired, or replayed state', async () => {
    const deps = dependencies();
    deps.consumeState.mockResolvedValue(null);
    expect(await completeEmailSignIn('state', 'action-code', deps)).toEqual({
      ok: false,
      reason: 'invalid_link',
    });
  });

  it('does not accept an e-mail-change state as a sign-in state', async () => {
    const deps = dependencies();
    deps.consumeState.mockResolvedValue({ ...record, purpose: 'email_change' });
    expect(await completeEmailSignIn('state', 'action-code', deps)).toEqual({
      ok: false,
      reason: 'invalid_link',
    });
    expect(deps.exchange).not.toHaveBeenCalled();
  });
});

describe(destinationFor, () => {
  it('sends admins to the admin portal', () => {
    expect(destinationFor({ ...profile, role: 'admin', clinic_id: null })).toBe('/admin');
  });

  it('holds pending clinic accounts on the waiting page', () => {
    expect(destinationFor({ ...profile, access_status: 'pending' })).toBe('/clinic/pending');
  });
});
