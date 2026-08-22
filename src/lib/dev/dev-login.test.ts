import { describe, expect, it, vi } from 'vitest';

import {
  DEV_ACCOUNTS,
  assertDevEmail,
  devLoginEnabled,
  ensureDevSession,
  parseDevLoginRole,
} from './dev-login';

const ENABLED = {
  NODE_ENV: 'development',
  DEV_LOGIN_ENABLED: 'true',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
} as NodeJS.ProcessEnv;

function store() {
  return {
    ensureIdentity: vi.fn().mockResolvedValue({ userId: 'dev-user', clinicId: null }),
    generateActionCode: vi.fn().mockResolvedValue('generated-action-code'),
  };
}

describe(devLoginEnabled, () => {
  it('stays off in production even when every flag is set', () => {
    expect(devLoginEnabled({ ...ENABLED, NODE_ENV: 'production' })).toBe(false);
  });

  it('stays off when the explicit opt-in flag is absent', () => {
    expect(devLoginEnabled({ ...ENABLED, DEV_LOGIN_ENABLED: undefined })).toBe(false);
  });

  it('stays off unless both Firebase services use loopback emulators', () => {
    expect(devLoginEnabled({ ...ENABLED, FIRESTORE_EMULATOR_HOST: undefined })).toBe(false);
    expect(
      devLoginEnabled({ ...ENABLED, FIREBASE_AUTH_EMULATOR_HOST: 'firebase.example:9099' }),
    ).toBe(false);
  });

  it('turns on only with the flag and both loopback emulators', () => {
    expect(devLoginEnabled(ENABLED)).toBe(true);
  });
});

describe(parseDevLoginRole, () => {
  it('refuses an unknown or missing role', () => {
    expect(parseDevLoginRole('superuser', ENABLED)).toBeNull();
    expect(parseDevLoginRole(null, ENABLED)).toBeNull();
  });

  it('accepts each seeded role only when the emulator gate is enabled', () => {
    expect(parseDevLoginRole('admin', ENABLED)).toBe('admin');
    expect(parseDevLoginRole('clinic', ENABLED)).toBe('clinic');
  });
});

describe(assertDevEmail, () => {
  it('rejects an address outside the reserved dev domain', () => {
    expect(() => assertDevEmail('person@outside.invalid')).toThrow(/example\.com/);
  });

  it('accepts a reserved dev address', () => {
    expect(() => assertDevEmail(DEV_ACCOUNTS.admin.email)).not.toThrow();
  });
});

describe(ensureDevSession, () => {
  it('provisions the selected emulator-only identity and returns an action code', async () => {
    const fake = store();
    expect(await ensureDevSession(fake, 'clinic')).toEqual({
      email: DEV_ACCOUNTS.clinic.email,
      userId: 'dev-user',
      actionCode: 'generated-action-code',
      destination: '/clinic',
    });
    expect(fake.ensureIdentity).toHaveBeenCalledWith('clinic', DEV_ACCOUNTS.clinic);
    expect(fake.generateActionCode).toHaveBeenCalledWith(DEV_ACCOUNTS.clinic.email);
  });

  it('uses the admin destination for the admin fixture', async () => {
    const fake = store();
    expect((await ensureDevSession(fake, 'admin')).destination).toBe('/admin');
  });
});
