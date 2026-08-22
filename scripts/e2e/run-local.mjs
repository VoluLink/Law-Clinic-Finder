import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';

const testEnvironment = {
  ...process.env,
  ANTHROPIC_API_KEY: 'emulator-anthropic-key',
  DEV_LOGIN_ENABLED: 'true',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_DATABASE_ID: 'primary-eu',
  FIREBASE_PROJECT_ID: 'law-clinic-finder',
  FIREBASE_STORAGE_BUCKET: 'law-clinic-finder.firebasestorage.app',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  IDENTITY_PLATFORM_API_KEY: 'emulator-api-key',
  NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST1234',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
  SMTP_FROM_EMAIL: 'sender@example.com',
  SMTP_FROM_NAME: 'Law Clinics Deutschland',
  SMTP_HOST: '127.0.0.1',
  SMTP_LOGIN_EMAIL: 'sender@example.com',
  SMTP_PASSWORD: 'emulator-only-password',
  SMTP_PORT: '2525',
};

const build = spawnSync('npm', ['run', 'build'], { env: testEnvironment, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });

const result = spawnSync(
  './node_modules/.bin/firebase',
  [
    'emulators:exec',
    '--project',
    'law-clinic-finder',
    '--only',
    'auth,firestore,storage',
    './node_modules/.bin/playwright test',
  ],
  { env: testEnvironment, stdio: 'inherit' },
);

process.exitCode = result.status ?? 1;
