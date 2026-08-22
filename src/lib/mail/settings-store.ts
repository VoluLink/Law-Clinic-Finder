import type { StoredSmtpSettings } from './smtp-settings';

/**
 * `missing` — the secret container is not provisioned yet, so the admin screen
 * stays read-only. `empty` — provisioned but never activated. `active` keeps the
 * previous enabled version as the last-known-good rollback candidate.
 */
export type SmtpSecretState =
  | { status: 'missing' }
  | { status: 'empty' }
  | { status: 'active'; stored: StoredSmtpSettings; previous: StoredSmtpSettings | null };

export type SmtpSettingsStore = {
  /** Send-path read of the active payload only; null when unavailable. */
  readActive(): Promise<StoredSmtpSettings | null>;
  /** Admin-path read including the rollback candidate. */
  load(): Promise<SmtpSecretState>;
  /** Adds one complete version; null when the secret container is missing. */
  activate(stored: StoredSmtpSettings): Promise<string | null>;
};
