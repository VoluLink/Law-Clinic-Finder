import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const accessSecretVersion = vi.hoisted(() => vi.fn());
const addSecretVersion = vi.hoisted(() => vi.fn());
const listEnabledVersions = vi.hoisted(() => vi.fn());
const firebaseConfig = vi.hoisted(() => vi.fn());

vi.mock('./secret-manager', () => ({ accessSecretVersion, addSecretVersion, listEnabledVersions }));
vi.mock('./env', () => ({ firebaseConfig }));

import { firebaseSmtpSettingsStore } from './smtp-settings-store';

const PAYLOAD = JSON.stringify({
  schemaVersion: 1,
  settings: {
    host: 'smtp.example.net',
    port: 587,
    tlsMode: 'starttls',
    loginEmail: 'login@example.net',
    password: 'secret-value',
    fromEmail: 'no-reply@example.net',
    fromName: 'Law Clinics',
  },
  updatedAt: '2026-08-22T10:00:00.000Z',
  updatedBy: 'admin-uid',
});

describe('firebaseSmtpSettingsStore', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    firebaseConfig.mockReset().mockReturnValue({ projectId: 'law-clinic-finder' });
    accessSecretVersion.mockReset().mockResolvedValue(PAYLOAD);
    listEnabledVersions.mockReset().mockResolvedValue(['4', '3']);
    addSecretVersion.mockReset().mockResolvedValue('5');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('reports a missing secret container instead of an empty configuration', async () => {
    listEnabledVersions.mockResolvedValue(null);

    await expect(firebaseSmtpSettingsStore.load()).resolves.toEqual({ status: 'missing' });
  });

  it('exposes the previous enabled version as the rollback candidate', async () => {
    const state = await firebaseSmtpSettingsStore.load();

    expect(state).toMatchObject({ status: 'active' });
    expect(listEnabledVersions).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'law-clinic-finder', secretId: 'smtpSettings' }),
    );
  });

  it('ignores a version whose payload no longer parses', async () => {
    accessSecretVersion.mockResolvedValue('{"schemaVersion":99}');

    await expect(firebaseSmtpSettingsStore.load()).resolves.toEqual({ status: 'empty' });
  });

  it('never reaches Secret Manager from an emulator run', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');

    await expect(firebaseSmtpSettingsStore.load()).resolves.toEqual({ status: 'missing' });
    await expect(firebaseSmtpSettingsStore.readActive()).resolves.toBeNull();
    expect(listEnabledVersions).not.toHaveBeenCalled();
    expect(accessSecretVersion).not.toHaveBeenCalled();
  });
});
