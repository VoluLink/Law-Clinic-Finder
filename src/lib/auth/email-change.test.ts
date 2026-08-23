import { describe, expect, it, vi } from 'vitest';

import type { EmailStateRecord } from './email-state';
import {
  completeEmailChange,
  requestEmailChange,
  type EmailChangeRequestDependencies,
} from './email-change';

const NOW = new Date('2026-08-16T10:00:00.000Z');
const USER_ID = 'admin-user';
const CURRENT_EMAIL = 'alt@example.org';
const NEW_EMAIL = 'neu@example.org';

function requestDependencies(): EmailChangeRequestDependencies {
  return {
    reserve: vi.fn().mockResolvedValue('ok'),
    release: vi.fn().mockResolvedValue(undefined),
    sendVerification: vi.fn().mockResolvedValue(undefined),
  };
}

const stateRecord: EmailStateRecord = {
  email: NEW_EMAIL,
  userId: USER_ID,
  purpose: 'email_change',
  codeHash: 'a'.repeat(64),
  createdAt: NOW,
  expiresAt: new Date(NOW.getTime() + 15 * 60_000),
};

describe(requestEmailChange, () => {
  it('requires authentication within the last five minutes', async () => {
    const deps = requestDependencies();
    const authTime = Math.floor(NOW.getTime() / 1_000) - 301;
    expect(
      await requestEmailChange(
        deps,
        { userId: USER_ID, currentEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL, authTime },
        NOW,
      ),
    ).toEqual({ status: 'reauth_required' });
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it('reserves the new address before sending verification', async () => {
    const deps = requestDependencies();
    const authTime = Math.floor(NOW.getTime() / 1_000);
    expect(
      await requestEmailChange(
        deps,
        { userId: USER_ID, currentEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL, authTime },
        NOW,
      ),
    ).toEqual({ status: 'sent' });
    expect(deps.reserve).toHaveBeenCalledWith(USER_ID, CURRENT_EMAIL, NEW_EMAIL, expect.any(Date));
    expect(deps.sendVerification).toHaveBeenCalledWith(USER_ID, CURRENT_EMAIL, NEW_EMAIL);
  });

  it('reports an address reserved by another identity', async () => {
    const deps = requestDependencies();
    vi.mocked(deps.reserve).mockResolvedValue('email_taken');
    const authTime = Math.floor(NOW.getTime() / 1_000);
    expect(
      await requestEmailChange(
        deps,
        { userId: USER_ID, currentEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL, authTime },
        NOW,
      ),
    ).toEqual({ status: 'email_taken' });
  });

  it('releases the pending reservation when delivery fails', async () => {
    const deps = requestDependencies();
    vi.mocked(deps.sendVerification).mockRejectedValue(new Error('smtp failed'));
    const authTime = Math.floor(NOW.getTime() / 1_000);
    expect(
      await requestEmailChange(
        deps,
        { userId: USER_ID, currentEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL, authTime },
        NOW,
      ),
    ).toEqual({ status: 'error' });
    expect(deps.release).toHaveBeenCalledWith(USER_ID, NEW_EMAIL);
  });
});

describe(completeEmailChange, () => {
  it('finalizes the change, revokes existing sessions, then consumes state', async () => {
    const dependencies = {
      lookup: vi.fn().mockResolvedValue(stateRecord),
      consume: vi.fn().mockResolvedValue(stateRecord),
      readAuthEmail: vi.fn().mockResolvedValue(CURRENT_EMAIL),
      applyActionCode: vi.fn().mockResolvedValue({ userId: USER_ID, email: NEW_EMAIL }),
      finalize: vi.fn().mockResolvedValue(undefined),
      revokeSessions: vi.fn().mockResolvedValue(undefined),
    };
    expect(await completeEmailChange('state', 'action-code', dependencies)).toEqual({ ok: true });
    expect(dependencies.finalize).toHaveBeenCalledWith(USER_ID, NEW_EMAIL);
    expect(dependencies.revokeSessions).toHaveBeenCalledWith(USER_ID);
    expect(dependencies.consume).toHaveBeenCalledWith('state', 'action-code');
    expect(dependencies.finalize.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.revokeSessions.mock.invocationCallOrder[0],
    );
    expect(dependencies.revokeSessions.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.consume.mock.invocationCallOrder[0],
    );
  });

  /*
   * The address is already changed in Firebase Auth by the time revocation runs,
   * so a revocation failure must not consume the one-time state — otherwise the
   * account keeps the new address while every pre-change session stays valid and
   * the visitor has no link left to finish with.
   */
  it('leaves the one-time state unconsumed when revocation fails', async () => {
    const dependencies = {
      lookup: vi.fn().mockResolvedValue(stateRecord),
      consume: vi.fn().mockResolvedValue(stateRecord),
      readAuthEmail: vi.fn().mockResolvedValue(CURRENT_EMAIL),
      applyActionCode: vi.fn().mockResolvedValue({ userId: USER_ID, email: NEW_EMAIL }),
      finalize: vi.fn().mockResolvedValue(undefined),
      revokeSessions: vi.fn().mockRejectedValue(new Error('revoke failed')),
    };
    await expect(completeEmailChange('state', 'action-code', dependencies)).rejects.toThrow();
    expect(dependencies.consume).not.toHaveBeenCalled();
  });

  it('completes on a retry after a revocation failure', async () => {
    const dependencies = {
      lookup: vi.fn().mockResolvedValue(stateRecord),
      consume: vi.fn().mockResolvedValue(stateRecord),
      readAuthEmail: vi.fn().mockResolvedValue(NEW_EMAIL),
      applyActionCode: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined),
      revokeSessions: vi
        .fn()
        .mockRejectedValueOnce(new Error('revoke failed'))
        .mockResolvedValue(undefined),
    };
    await expect(completeEmailChange('state', 'action-code', dependencies)).rejects.toThrow();
    expect(await completeEmailChange('state', 'action-code', dependencies)).toEqual({ ok: true });
    expect(dependencies.consume).toHaveBeenCalledTimes(1);
  });

  it('recovers after the Auth action was applied before a retry', async () => {
    const dependencies = {
      lookup: vi.fn().mockResolvedValue(stateRecord),
      consume: vi.fn().mockResolvedValue(stateRecord),
      readAuthEmail: vi.fn().mockResolvedValue(NEW_EMAIL),
      applyActionCode: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined),
      revokeSessions: vi.fn().mockResolvedValue(undefined),
    };
    expect(await completeEmailChange('state', 'action-code', dependencies)).toEqual({ ok: true });
    expect(dependencies.applyActionCode).not.toHaveBeenCalled();
  });

  it('rejects a non-email-change state', async () => {
    const dependencies = {
      lookup: vi.fn().mockResolvedValue({ ...stateRecord, purpose: 'login' as const }),
      consume: vi.fn(),
      readAuthEmail: vi.fn(),
      applyActionCode: vi.fn(),
      finalize: vi.fn(),
      revokeSessions: vi.fn(),
    };
    expect(await completeEmailChange('state', 'action-code', dependencies)).toEqual({ ok: false });
    expect(dependencies.applyActionCode).not.toHaveBeenCalled();
  });
});
