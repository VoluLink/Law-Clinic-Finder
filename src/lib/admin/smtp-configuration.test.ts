import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmtpSecretState, SmtpSettingsStore } from '@/lib/mail/settings-store';
import type { SmtpSettings, SmtpSettingsUpdate } from '@/lib/mail/smtp-settings';

import { activateSmtpSettings, rollbackSmtpSettings } from './smtp-configuration';

const ACTIVE_SETTINGS: SmtpSettings = {
  host: 'smtp.example.net',
  port: 587,
  tlsMode: 'starttls',
  loginEmail: 'login@example.net',
  password: 'active-secret',
  fromEmail: 'no-reply@example.net',
  fromName: 'Law Clinics',
};

const UPDATE: SmtpSettingsUpdate = {
  host: 'smtp.other.net',
  port: 587,
  tlsMode: 'starttls',
  loginEmail: 'login@example.net',
  fromEmail: 'no-reply@example.net',
  fromName: 'Law Clinics',
};

const NOW = new Date('2026-08-22T12:00:00.000Z');

const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };

function activeState(previousHost = 'smtp.previous.net'): SmtpSecretState {
  return {
    status: 'active',
    stored: {
      schemaVersion: 1,
      settings: ACTIVE_SETTINGS,
      updatedAt: NOW.toISOString(),
      updatedBy: 'earlier-admin',
    },
    previous: {
      schemaVersion: 1,
      settings: { ...ACTIVE_SETTINGS, host: previousHost },
      updatedAt: '2026-08-01T12:00:00.000Z',
      updatedBy: 'earlier-admin',
    },
  };
}

function dependencies(state: SmtpSecretState, verified = true) {
  const store: SmtpSettingsStore = {
    readActive: vi.fn(),
    load: vi.fn().mockResolvedValue(state),
    activate: vi.fn().mockResolvedValue('4'),
  };
  const verify = vi
    .fn()
    .mockResolvedValue(
      verified ? { ok: true } : { ok: false, failure: 'authentication', reason: 'Invalid login' },
    );
  return { store, verify, logger, now: () => NOW };
}

describe(activateSmtpSettings.name, () => {
  beforeEach(() => {
    logger.info.mockReset();
    logger.warn.mockReset();
  });

  it('keeps the active password when the admin does not supply a new one', async () => {
    const deps = dependencies(activeState());

    const result = await activateSmtpSettings(deps, { update: UPDATE, actorId: 'admin-uid' });

    expect(result).toEqual({ status: 'activated', version: '4', changed: ['host'] });
    expect(deps.store.activate).toHaveBeenCalledWith({
      schemaVersion: 1,
      settings: { ...UPDATE, password: 'active-secret' },
      updatedAt: NOW.toISOString(),
      updatedBy: 'admin-uid',
    });
  });

  it('verifies the proposed settings before activating them', async () => {
    const deps = dependencies(activeState(), false);

    const result = await activateSmtpSettings(deps, { update: UPDATE, actorId: 'admin-uid' });

    expect(result).toEqual({ status: 'verification_failed', failure: 'authentication' });
    expect(deps.store.activate).not.toHaveBeenCalled();
  });

  it('records an audit event with changed field names only', async () => {
    const deps = dependencies(activeState());

    await activateSmtpSettings(deps, { update: UPDATE, actorId: 'admin-uid' });

    expect(logger.info).toHaveBeenCalledWith('smtp configuration activated', {
      actorId: 'admin-uid',
      version: '4',
      fields: ['host'],
    });
  });

  it('requires a password for the first activation', async () => {
    const deps = dependencies({ status: 'empty' });

    await expect(
      activateSmtpSettings(deps, { update: UPDATE, actorId: 'admin-uid' }),
    ).resolves.toEqual({ status: 'password_required' });
  });

  it('activates the first version with a supplied password', async () => {
    const deps = dependencies({ status: 'empty' });

    const result = await activateSmtpSettings(deps, {
      update: { ...UPDATE, password: 'first-secret' },
      actorId: 'admin-uid',
    });

    expect(result).toMatchObject({ status: 'activated', changed: expect.any(Array) });
  });

  it('reports an unprovisioned secret instead of writing', async () => {
    const deps = dependencies({ status: 'missing' });

    await expect(
      activateSmtpSettings(deps, { update: UPDATE, actorId: 'admin-uid' }),
    ).resolves.toEqual({ status: 'not_provisioned' });
  });
});

describe(rollbackSmtpSettings.name, () => {
  it('re-activates the retained last-known-good version', async () => {
    const deps = dependencies(activeState());

    const result = await rollbackSmtpSettings(deps, { actorId: 'admin-uid' });

    expect(result).toEqual({ status: 'activated', version: '4', changed: ['host'] });
    expect(deps.store.activate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ host: 'smtp.previous.net' }),
        updatedBy: 'admin-uid',
      }),
    );
  });

  it('reports that no rollback target exists after a first activation', async () => {
    const deps = dependencies({ ...activeState(), previous: null } as SmtpSecretState);

    await expect(rollbackSmtpSettings(deps, { actorId: 'admin-uid' })).resolves.toEqual({
      status: 'no_rollback_target',
    });
  });

  it('does not activate a retained version that no longer authenticates', async () => {
    const deps = dependencies(activeState(), false);

    await expect(rollbackSmtpSettings(deps, { actorId: 'admin-uid' })).resolves.toMatchObject({
      status: 'verification_failed',
    });
  });
});
