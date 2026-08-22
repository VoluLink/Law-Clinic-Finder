import 'server-only';

import type { SmtpSecretState, SmtpSettingsStore } from '@/lib/mail/settings-store';
import {
  parseStoredSmtpSettings,
  serializeStoredSmtpSettings,
  type StoredSmtpSettings,
} from '@/lib/mail/smtp-settings';

import { firebaseConfig } from './env';
import {
  accessSecretVersion,
  addSecretVersion,
  listEnabledVersions,
  type SecretReference,
} from './secret-manager';

const DEFAULT_SECRET_ID = 'smtpSettings';

/** Only the newest versions can be active or the rollback candidate; reading
 *  more would cost extra Secret Manager access operations for nothing. */
const VERSION_LOOKBACK = 3;

/** The project id is the validated, pinned one — never a free-form value. */
function secretReference(): SecretReference {
  return {
    projectId: firebaseConfig().projectId,
    secretId: process.env.SMTP_SETTINGS_SECRET ?? DEFAULT_SECRET_ID,
    location: process.env.SMTP_SETTINGS_SECRET_LOCATION || null,
  };
}

async function readVersion(
  secret: SecretReference,
  version: string,
): Promise<StoredSmtpSettings | null> {
  const raw = await accessSecretVersion(secret, version);
  if (!raw) return null;
  try {
    return parseStoredSmtpSettings(raw);
  } catch {
    return null;
  }
}

/** Emulator and E2E runs must never reach live Secret Manager, even when the
 *  developer machine happens to hold application default credentials. */
function emulated(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST ?? process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

async function readActive(): Promise<StoredSmtpSettings | null> {
  if (emulated()) return null;
  return readVersion(secretReference(), 'latest');
}

async function load(): Promise<SmtpSecretState> {
  if (emulated()) return { status: 'missing' };
  const secret = secretReference();
  const versions = await listEnabledVersions(secret);
  if (versions === null) return { status: 'missing' };
  const payloads = await Promise.all(
    versions.slice(0, VERSION_LOOKBACK).map((version) => readVersion(secret, version)),
  );
  const usable = payloads.filter((payload): payload is StoredSmtpSettings => payload !== null);
  const [stored, previous = null] = usable;
  if (!stored) return { status: 'empty' };
  return { status: 'active', stored, previous };
}

async function activate(stored: StoredSmtpSettings): Promise<string | null> {
  if (emulated()) return null;
  return addSecretVersion(secretReference(), serializeStoredSmtpSettings(stored));
}

export const firebaseSmtpSettingsStore: SmtpSettingsStore = { readActive, load, activate };
