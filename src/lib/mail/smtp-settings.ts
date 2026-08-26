import { z } from 'zod';

import type { SmtpConfig } from '@/lib/firebase/env';

/** Provider-neutral TLS behavior: implicit TLS on connect, or mandatory STARTTLS. */
export const SMTP_TLS_MODES = ['implicit', 'starttls'] as const;
export type SmtpTlsMode = (typeof SMTP_TLS_MODES)[number];

export const SMTP_SETTINGS_SCHEMA_VERSION = 1;

/** A dotted DNS name whose last label is alphabetic. That shape rules out an IP
 *  literal and a bare `localhost`, both of which only exist to defeat a
 *  name-based destination check; every real provider is reached by name. */
const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
    'Nur ein öffentlicher Hostname, keine URL und keine IP-Adresse.',
  );

const senderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[^\r\n]+$/);

export const smtpSettingsSchema = z
  .object({
    host: hostSchema,
    port: z.number().int().min(1).max(65_535),
    tlsMode: z.enum(SMTP_TLS_MODES),
    loginEmail: z.email().max(200),
    password: z.string().min(1).max(1_000),
    fromEmail: z.email().max(200),
    fromName: senderNameSchema,
  })
  .strict();

export type SmtpSettings = z.infer<typeof smtpSettingsSchema>;

/** Admin payload. An omitted password keeps the currently active one. */
export const smtpSettingsUpdateSchema = smtpSettingsSchema
  .omit({ password: true })
  .extend({ password: z.string().min(1).max(1_000).optional() })
  .strict();

export type SmtpSettingsUpdate = z.infer<typeof smtpSettingsUpdateSchema>;

/**
 * One complete versioned Secret Manager payload. The whole configuration moves
 * atomically, so a rollback restores a set that once passed verification.
 */
export const storedSmtpSettingsSchema = z
  .object({
    schemaVersion: z.literal(SMTP_SETTINGS_SCHEMA_VERSION),
    settings: smtpSettingsSchema,
    updatedAt: z.iso.datetime({ offset: true }),
    updatedBy: z.string().min(1).max(128),
  })
  .strict();

export type StoredSmtpSettings = z.infer<typeof storedSmtpSettingsSchema>;

export function parseStoredSmtpSettings(raw: string): StoredSmtpSettings {
  return storedSmtpSettingsSchema.parse(JSON.parse(raw));
}

export function serializeStoredSmtpSettings(stored: StoredSmtpSettings): string {
  return JSON.stringify(storedSmtpSettingsSchema.parse(stored));
}

export function toSmtpConfig(settings: SmtpSettings): SmtpConfig {
  const { tlsMode, ...rest } = settings;
  return { ...rest, secure: tlsMode === 'implicit', requireTls: tlsMode === 'starttls' };
}

export type SmtpSettingsSource = 'secret' | 'environment' | 'none';

/** Browser-facing projection. The password is never part of it. */
export type SmtpSettingsView = {
  /** False while the Secret Manager container itself does not exist yet. */
  provisioned: boolean;
  source: SmtpSettingsSource;
  passwordSet: boolean;
  values: Omit<SmtpSettings, 'password'> | null;
  updatedAt: string | null;
  updatedBy: string | null;
  rollbackAvailable: boolean;
};

export function smtpSettingsView(
  stored: StoredSmtpSettings | null,
  options: { environmentFallback: boolean; rollbackAvailable: boolean; provisioned: boolean },
): SmtpSettingsView {
  if (!stored) {
    return {
      provisioned: options.provisioned,
      source: options.environmentFallback ? 'environment' : 'none',
      passwordSet: options.environmentFallback,
      values: null,
      updatedAt: null,
      updatedBy: null,
      rollbackAvailable: false,
    };
  }
  return {
    provisioned: true,
    source: 'secret',
    passwordSet: true,
    values: withoutPassword(stored.settings),
    updatedAt: stored.updatedAt,
    updatedBy: stored.updatedBy,
    rollbackAvailable: options.rollbackAvailable,
  };
}

/** Allow-listed projection: a new field is invisible to the browser until it is
 *  named here, so a future secret cannot leak by being spread into the view. */
function withoutPassword(settings: SmtpSettings): Omit<SmtpSettings, 'password'> {
  return {
    host: settings.host,
    port: settings.port,
    tlsMode: settings.tlsMode,
    loginEmail: settings.loginEmail,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
  };
}

/** Audit metadata: field names only, never values. */
export function changedSettingFields(
  previous: SmtpSettings | null,
  next: SmtpSettings,
): (keyof SmtpSettings)[] {
  const keys = Object.keys(smtpSettingsSchema.shape) as (keyof SmtpSettings)[];
  if (!previous) return keys;
  return keys.filter((key) => previous[key] !== next[key]);
}
