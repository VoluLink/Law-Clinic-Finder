import { describe, expect, it } from 'vitest';

import { ConfigurationError, parseFirebaseConfig, parseSmtpConfig } from './env';

const firebaseEnv = {
  FIREBASE_PROJECT_ID: 'law-clinic-finder',
  FIREBASE_DATABASE_ID: 'primary-eu',
  FIREBASE_STORAGE_BUCKET: 'law-clinic-finder.firebasestorage.app',
  IDENTITY_PLATFORM_API_KEY: 'public-web-api-key',
  NEXT_PUBLIC_SITE_URL: 'https://law-clinic-finder.web.app',
};

const smtpEnv = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
  SMTP_LOGIN_EMAIL: 'mailer@example.com',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM_EMAIL: 'sender@example.com',
  SMTP_FROM_NAME: 'Law Clinics Deutschland',
};

describe(parseFirebaseConfig, () => {
  it('accepts the confirmed Firebase project', () => {
    expect(parseFirebaseConfig(firebaseEnv)).toEqual({
      projectId: 'law-clinic-finder',
      databaseId: 'primary-eu',
      storageBucket: 'law-clinic-finder.firebasestorage.app',
      webApiKey: 'public-web-api-key',
      siteUrl: 'https://law-clinic-finder.web.app',
    });
  });

  it('uses the Google runtime project id when the explicit value is absent', () => {
    const withoutExplicitProject = { ...firebaseEnv, FIREBASE_PROJECT_ID: undefined };
    expect(
      parseFirebaseConfig({
        ...withoutExplicitProject,
        GOOGLE_CLOUD_PROJECT: 'law-clinic-finder',
      }).projectId,
    ).toBe('law-clinic-finder');
  });

  it('rejects an unexpected target project', () => {
    expect(() =>
      parseFirebaseConfig({ ...firebaseEnv, FIREBASE_PROJECT_ID: 'wrong-project' }),
    ).toThrow(ConfigurationError);
  });

  it('rejects the unintended default database', () => {
    expect(() =>
      parseFirebaseConfig({ ...firebaseEnv, FIREBASE_DATABASE_ID: '(default)' }),
    ).toThrow(ConfigurationError);
  });

  it('rejects a site URL containing credentials', () => {
    expect(() =>
      parseFirebaseConfig({
        ...firebaseEnv,
        NEXT_PUBLIC_SITE_URL: 'https://user:pass@example.com',
      }),
    ).toThrow(ConfigurationError);
  });

  it('rejects a non-TLS public site URL', () => {
    expect(() =>
      parseFirebaseConfig({
        ...firebaseEnv,
        NEXT_PUBLIC_SITE_URL: 'http://law-clinic-finder.web.app',
      }),
    ).toThrow(ConfigurationError);
  });

  it('allows HTTP only for local emulator development', () => {
    expect(
      parseFirebaseConfig({ ...firebaseEnv, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })
        .siteUrl,
    ).toBe('http://localhost:3000');
  });
});

describe(parseSmtpConfig, () => {
  it('uses required STARTTLS for the configured submission port', () => {
    expect(parseSmtpConfig(smtpEnv)).toMatchObject({ secure: false, requireTls: true });
  });

  it('uses implicit TLS on port 465', () => {
    expect(parseSmtpConfig({ ...smtpEnv, SMTP_PORT: '465' })).toMatchObject({
      secure: true,
      requireTls: false,
    });
  });

  it('allows changing SMTP hosts without provider-specific settings', () => {
    expect(parseSmtpConfig({ ...smtpEnv, SMTP_HOST: 'smtp.example.net' }).host).toBe(
      'smtp.example.net',
    );
  });

  it('requires the SMTP login to be an e-mail address', () => {
    expect(() => parseSmtpConfig({ ...smtpEnv, SMTP_LOGIN_EMAIL: 'not-an-email' })).toThrow(
      ConfigurationError,
    );
  });

  it('uses the login address as the sender when no sender is configured', () => {
    const withoutSender = { ...smtpEnv, SMTP_FROM_EMAIL: undefined };
    expect(parseSmtpConfig(withoutSender).fromEmail).toBe('mailer@example.com');
  });
});
