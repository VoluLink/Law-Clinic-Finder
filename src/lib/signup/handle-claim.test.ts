import { describe, expect, it, vi } from 'vitest';

import type { ClaimMatch } from './directory';
import { claimClinic, signupClaimSchema, type ClaimDeps } from './handle-claim';
import { testLogger } from './test-utils';

const NOW = new Date('2025-06-15T12:00:00.000Z');
const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000001';
const SUPPLIED_EMAIL = 'new-address@example.org';

const onFileMatch: ClaimMatch = {
  id: CLINIC_ID,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  claimed: false,
  hasContactEmail: true,
  maskedEmail: 'k****t@example.org',
};

function dependencies(match: ClaimMatch | null = onFileMatch): ClaimDeps {
  return {
    store: {
      readMatch: vi.fn().mockResolvedValue(match),
      isEmailTaken: vi.fn().mockResolvedValue(false),
      reserveAttempt: vi.fn().mockResolvedValue({ allowed: true }),
    },
    logger: testLogger(),
    invite: vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID }),
    claimWithEmail: vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID }),
  };
}

describe('signupClaimSchema', () => {
  it('rejects non-UUID clinic IDs', () => {
    expect(signupClaimSchema.safeParse({ clinicId: '1; drop table' }).success).toBe(false);
  });

  it('rejects a malformed supplied e-mail', () => {
    expect(signupClaimSchema.safeParse({ clinicId: CLINIC_ID, email: 'nope' }).success).toBe(false);
  });
});

describe(claimClinic, () => {
  it('reserves and sends to the address already on file', async () => {
    const deps = dependencies();
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'sent',
      maskedEmail: onFileMatch.maskedEmail,
    });
    expect(deps.store.reserveAttempt).toHaveBeenCalledWith(CLINIC_ID, NOW);
    expect(deps.invite).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('returns the transactional retry window without sending', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.reserveAttempt).mockResolvedValue({ allowed: false, retryDays: 5 });
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'blocked',
      retryDays: 5,
    });
    expect(deps.invite).not.toHaveBeenCalled();
  });

  it('maps an existing active account to already claimed', async () => {
    const deps = dependencies();
    vi.mocked(deps.invite).mockResolvedValue({ status: 'already_invited' });
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'already_claimed',
    });
  });

  it('does not reserve an attempt for an unknown clinic', async () => {
    const deps = dependencies(null);
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({ status: 'not_found' });
    expect(deps.store.reserveAttempt).not.toHaveBeenCalled();
  });

  it('asks for an address before reserving when none is on file', async () => {
    const deps = dependencies({ ...onFileMatch, hasContactEmail: false, maskedEmail: null });
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'email_required',
    });
    expect(deps.store.reserveAttempt).not.toHaveBeenCalled();
  });

  it('rejects a second claimant before reserving an attempt', async () => {
    const deps = dependencies({
      ...onFileMatch,
      claimed: true,
      hasContactEmail: false,
      maskedEmail: null,
    });
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'already_claimed',
    });
    expect(deps.store.reserveAttempt).not.toHaveBeenCalled();
  });

  it('rejects an e-mail reserved by another identity', async () => {
    const deps = dependencies({ ...onFileMatch, hasContactEmail: false, maskedEmail: null });
    vi.mocked(deps.store.isEmailTaken).mockResolvedValue(true);
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'email_taken',
    });
    expect(deps.store.reserveAttempt).not.toHaveBeenCalled();
  });

  it('reserves then creates a pending claim for a supplied address', async () => {
    const deps = dependencies({ ...onFileMatch, hasContactEmail: false, maskedEmail: null });
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'pending_review',
      email: SUPPLIED_EMAIL,
    });
    expect(deps.claimWithEmail).toHaveBeenCalledWith(CLINIC_ID, SUPPLIED_EMAIL);
  });

  it('maps a reservation collision during identity creation to e-mail taken', async () => {
    const deps = dependencies({ ...onFileMatch, hasContactEmail: false, maskedEmail: null });
    vi.mocked(deps.claimWithEmail).mockResolvedValue({ status: 'already_invited' });
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'email_taken',
    });
  });

  it('maps failed delivery to a generic error', async () => {
    const deps = dependencies();
    vi.mocked(deps.invite).mockResolvedValue({
      status: 'invite_failed',
      clinicId: CLINIC_ID,
    });
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({ status: 'error' });
  });

  it('maps store failures to a generic error', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.readMatch).mockRejectedValue(new Error('private detail'));
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({ status: 'error' });
    expect(deps.logger.warn).toHaveBeenCalledWith('clinic claim failed', {
      reason: 'private detail',
    });
  });
});
