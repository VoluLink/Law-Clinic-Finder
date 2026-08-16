import { describe, expect, it, vi } from 'vitest';

import { claimClinic, signupClaimSchema, type ClaimDeps } from './handle-claim';
import { createAdminClientMock, testLogger, type QueryResult } from './test-utils';

const NOW = 1_750_000_000_000;
const MS_PER_DAY = 86_400_000;
const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000001';
const SUPPLIED_EMAIL = 'kontakt@neue-adresse.de';

const unclaimedRow = {
  id: CLINIC_ID,
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Köln',
  contact_email: 'kontakt@milcc.de',
  profiles: [],
};

const withoutEmail = { ...unclaimedRow, contact_email: null };

function createDeps(responses: QueryResult[], overrides?: Partial<ClaimDeps>) {
  const mock = createAdminClientMock(responses);
  const deps: ClaimDeps = {
    adminClient: mock.client as never,
    logger: testLogger(),
    invite: vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID }),
    claimWithEmail: vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID }),
    isEmailTaken: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { deps, mock };
}

describe('signupClaimSchema', () => {
  it('rejects non-uuid clinic ids', () => {
    expect(signupClaimSchema.safeParse({ clinicId: '1; drop table' }).success).toBe(false);
  });

  it('rejects a malformed supplied email', () => {
    const parsed = signupClaimSchema.safeParse({ clinicId: CLINIC_ID, email: 'nope' });
    expect(parsed.success).toBe(false);
  });
});

describe('claimClinic with an address on file', () => {
  it('invites the on-file address and records the send', async () => {
    const { deps, mock } = createDeps([
      { data: unclaimedRow, error: null },
      { data: [], error: null },
      { data: null, error: null },
    ]);
    const result = await claimClinic(deps, CLINIC_ID, undefined, NOW);
    expect(result).toEqual({ status: 'sent', maskedEmail: 'k****t@milcc.de' });
    expect(deps.invite).toHaveBeenCalledWith(CLINIC_ID);
    expect(mock.calls).toContainEqual(['insert', [{ clinic_id: CLINIC_ID }]]);
  });

  it('reports a linked clinic as claimed when its access helper finds an active account', async () => {
    const row = { ...unclaimedRow, profiles: [{ user_id: 'user-1' }] };
    const invite = vi.fn().mockResolvedValue({ status: 'already_invited' });
    const { deps } = createDeps([{ data: row, error: null }], { invite });
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'already_claimed',
    });
    expect(invite).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('resends and records a link for a linked account that is still pending', async () => {
    const row = { ...unclaimedRow, profiles: [{ user_id: 'user-1' }] };
    const { deps, mock } = createDeps([
      { data: row, error: null },
      { data: [{ sent_at: new Date(NOW - MS_PER_DAY).toISOString() }], error: null },
      { data: null, error: null },
    ]);

    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'sent',
      maskedEmail: 'k****t@milcc.de',
    });
    expect(mock.calls).toContainEqual(['insert', [{ clinic_id: CLINIC_ID }]]);
  });

  it('blocks after two sends within seven days and names the wait', async () => {
    const sends = [
      { sent_at: new Date(NOW - 2 * MS_PER_DAY).toISOString() },
      { sent_at: new Date(NOW - MS_PER_DAY).toISOString() },
    ];
    const { deps } = createDeps([
      { data: unclaimedRow, error: null },
      { data: sends, error: null },
    ]);
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'blocked',
      retryDays: 5,
    });
    expect(deps.invite).not.toHaveBeenCalled();
  });

  it('allows again once the oldest send falls out of the window', async () => {
    const sends = [{ sent_at: new Date(NOW - MS_PER_DAY).toISOString() }];
    const { deps } = createDeps([
      { data: unclaimedRow, error: null },
      { data: sends, error: null },
      { data: null, error: null },
    ]);
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toMatchObject({ status: 'sent' });
  });

  it('returns not_found for unknown ids', async () => {
    const { deps } = createDeps([{ data: null, error: null }]);
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({ status: 'not_found' });
  });

  it('maps a failed invite to error without recording a send', async () => {
    const { deps, mock } = createDeps(
      [
        { data: unclaimedRow, error: null },
        { data: [], error: null },
      ],
      { invite: vi.fn().mockResolvedValue({ status: 'invite_failed', clinicId: CLINIC_ID }) },
    );
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({ status: 'error' });
    expect(mock.calls).not.toContainEqual(['insert', [{ clinic_id: CLINIC_ID }]]);
  });
});

describe('claimClinic without an address on file', () => {
  it('asks for an address instead of dead-ending', async () => {
    const { deps } = createDeps([
      { data: withoutEmail, error: null },
      { data: [], error: null },
    ]);
    expect(await claimClinic(deps, CLINIC_ID, undefined, NOW)).toEqual({
      status: 'email_required',
    });
  });

  it('invites the supplied address and leaves access pending', async () => {
    const { deps } = createDeps([
      { data: withoutEmail, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'pending_review',
      email: SUPPLIED_EMAIL,
    });
    expect(deps.claimWithEmail).toHaveBeenCalledWith(CLINIC_ID, SUPPLIED_EMAIL);
  });

  it('stores the supplied address on the clinic', async () => {
    const { deps, mock } = createDeps([
      { data: withoutEmail, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW);
    expect(mock.calls).toContainEqual(['update', [{ contact_email: SUPPLIED_EMAIL }]]);
  });

  it('refuses a second claimant while the first claim is open', async () => {
    const claimed = { ...withoutEmail, profiles: [{ user_id: 'user-1' }] };
    const { deps } = createDeps([
      { data: claimed, error: null },
      { data: [], error: null },
    ]);
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'already_claimed',
    });
    expect(deps.claimWithEmail).not.toHaveBeenCalled();
  });

  it('refuses an address that already belongs to another account', async () => {
    const { deps } = createDeps(
      [
        { data: withoutEmail, error: null },
        { data: [], error: null },
      ],
      { isEmailTaken: vi.fn().mockResolvedValue(true) },
    );
    expect(await claimClinic(deps, CLINIC_ID, SUPPLIED_EMAIL, NOW)).toEqual({
      status: 'email_taken',
    });
    expect(deps.claimWithEmail).not.toHaveBeenCalled();
  });
});
