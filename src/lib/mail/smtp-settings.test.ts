import { describe, expect, it } from 'vitest';

import {
  changedSettingFields,
  parseStoredSmtpSettings,
  serializeStoredSmtpSettings,
  smtpSettingsUpdateSchema,
  smtpSettingsView,
  toSmtpConfig,
  type SmtpSettings,
  type StoredSmtpSettings,
} from './smtp-settings';

const SETTINGS: SmtpSettings = {
  host: 'smtp.example.net',
  port: 587,
  tlsMode: 'starttls',
  loginEmail: 'login@example.net',
  password: 'secret-value',
  fromEmail: 'no-reply@example.net',
  fromName: 'Law Clinics',
};

const STORED: StoredSmtpSettings = {
  schemaVersion: 1,
  settings: SETTINGS,
  updatedAt: '2026-08-22T10:00:00.000Z',
  updatedBy: 'admin-uid',
};

describe(toSmtpConfig.name, () => {
  it('maps STARTTLS to a required upgrade on an insecure connection', () => {
    expect(toSmtpConfig(SETTINGS)).toMatchObject({ secure: false, requireTls: true });
  });

  it('maps implicit TLS to a secure connection', () => {
    expect(toSmtpConfig({ ...SETTINGS, port: 465, tlsMode: 'implicit' })).toMatchObject({
      secure: true,
      requireTls: false,
    });
  });
});

describe('smtpSettingsUpdateSchema', () => {
  it('accepts an update without a password so the active one is kept', () => {
    const update = {
      host: SETTINGS.host,
      port: SETTINGS.port,
      tlsMode: SETTINGS.tlsMode,
      loginEmail: SETTINGS.loginEmail,
      fromEmail: SETTINGS.fromEmail,
      fromName: SETTINGS.fromName,
    };

    expect(smtpSettingsUpdateSchema.parse(update).password).toBeUndefined();
  });

  it('rejects a host given as a URL', () => {
    expect(
      smtpSettingsUpdateSchema.safeParse({ ...SETTINGS, host: 'https://smtp.example.net' }),
    ).toMatchObject({ success: false });
  });

  it('rejects unknown fields', () => {
    expect(smtpSettingsUpdateSchema.safeParse({ ...SETTINGS, provider: 'brevo' })).toMatchObject({
      success: false,
    });
  });
});

describe(smtpSettingsView.name, () => {
  it('never exposes the password and reports it as set', () => {
    const view = smtpSettingsView(STORED, {
      environmentFallback: false,
      rollbackAvailable: true,
      provisioned: true,
    });

    expect(view).toEqual({
      provisioned: true,
      source: 'secret',
      passwordSet: true,
      values: {
        host: 'smtp.example.net',
        port: 587,
        tlsMode: 'starttls',
        loginEmail: 'login@example.net',
        fromEmail: 'no-reply@example.net',
        fromName: 'Law Clinics',
      },
      updatedAt: '2026-08-22T10:00:00.000Z',
      updatedBy: 'admin-uid',
      rollbackAvailable: true,
    });
  });

  it('reports the environment fallback while no secret version exists', () => {
    const view = smtpSettingsView(null, {
      environmentFallback: true,
      rollbackAvailable: false,
      provisioned: true,
    });

    expect(view).toMatchObject({ source: 'environment', passwordSet: true, values: null });
  });

  it('reports an unconfigured mailer when neither source is present', () => {
    const view = smtpSettingsView(null, {
      environmentFallback: false,
      rollbackAvailable: false,
      provisioned: false,
    });

    expect(view).toMatchObject({ source: 'none', passwordSet: false });
  });
});

describe(changedSettingFields.name, () => {
  it('lists only the field names that differ', () => {
    const next = { ...SETTINGS, host: 'smtp.other.net', password: 'rotated' };

    expect(changedSettingFields(SETTINGS, next)).toEqual(['host', 'password']);
  });

  it('lists every field for the first activation', () => {
    expect(changedSettingFields(null, SETTINGS)).toHaveLength(7);
  });
});

describe(parseStoredSmtpSettings.name, () => {
  it('round-trips a stored payload', () => {
    expect(parseStoredSmtpSettings(serializeStoredSmtpSettings(STORED))).toEqual(STORED);
  });

  it('rejects a payload written by an unknown schema version', () => {
    const raw = JSON.stringify({ ...STORED, schemaVersion: 2 });

    expect(() => parseStoredSmtpSettings(raw)).toThrow();
  });
});
