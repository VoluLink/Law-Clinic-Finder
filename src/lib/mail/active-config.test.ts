import { beforeEach, describe, expect, it, vi } from 'vitest';

const smtpConfig = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase/env', () => ({ smtpConfig }));
vi.mock('@/lib/firebase/smtp-settings-store', () => ({ firebaseSmtpSettingsStore: {} }));

import { activeSmtpConfig, resetActiveSmtpConfigCache } from './active-config';
import type { StoredSmtpSettings } from './smtp-settings';

const ENVIRONMENT = {
  host: 'env.example.net',
  port: 587,
  loginEmail: 'env@example.net',
  password: 'env-secret',
  fromEmail: 'env@example.net',
  fromName: 'Environment',
  secure: false,
  requireTls: true,
};

const STORED: StoredSmtpSettings = {
  schemaVersion: 1,
  settings: {
    host: 'secret.example.net',
    port: 465,
    tlsMode: 'implicit',
    loginEmail: 'secret@example.net',
    password: 'secret-value',
    fromEmail: 'secret@example.net',
    fromName: 'Activated',
  },
  updatedAt: '2026-08-22T10:00:00.000Z',
  updatedBy: 'admin-uid',
};

const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };

function dependencies(readActive: () => Promise<StoredSmtpSettings | null>, now = () => 1_000) {
  return { store: { readActive, load: vi.fn(), activate: vi.fn() }, logger, now };
}

describe(activeSmtpConfig.name, () => {
  beforeEach(() => {
    resetActiveSmtpConfigCache();
    smtpConfig.mockReset().mockReturnValue(ENVIRONMENT);
    logger.warn.mockReset();
  });

  it('prefers the activated secret payload over the environment', async () => {
    const config = await activeSmtpConfig(dependencies(() => Promise.resolve(STORED)));

    expect(config).toMatchObject({ host: 'secret.example.net', secure: true, requireTls: false });
    expect(smtpConfig).not.toHaveBeenCalled();
  });

  it('falls back to the environment while no version is activated', async () => {
    const config = await activeSmtpConfig(dependencies(() => Promise.resolve(null)));

    expect(config).toBe(ENVIRONMENT);
  });

  it('serves the cache without reading the secret again inside the window', async () => {
    const readActive = vi.fn().mockResolvedValue(STORED);

    await activeSmtpConfig(dependencies(readActive, () => 1_000));
    await activeSmtpConfig(dependencies(readActive, () => 2_000));

    expect(readActive).toHaveBeenCalledTimes(1);
  });

  it('keeps the last activated configuration when a later read fails', async () => {
    const readActive = vi
      .fn()
      .mockResolvedValueOnce(STORED)
      .mockRejectedValueOnce(new Error('unavailable'));

    await activeSmtpConfig(dependencies(readActive, () => 1_000));
    const config = await activeSmtpConfig(dependencies(readActive, () => 10_000_000));

    expect(config).toMatchObject({ host: 'secret.example.net' });
    expect(logger.warn).toHaveBeenCalledWith('smtp configuration read failed', { reason: 'Error' });
  });
});
