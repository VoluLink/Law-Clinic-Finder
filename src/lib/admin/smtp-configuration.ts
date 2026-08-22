import { z } from 'zod';

import type { SmtpConfig } from '@/lib/firebase/env';
import type { Logger } from '@/lib/logger';
import type { SmtpSettingsStore } from '@/lib/mail/settings-store';
import { SMTP_VERIFICATION_FAILURES, type SmtpVerificationResult } from '@/lib/mail/smtp';
import {
  changedSettingFields,
  smtpSettingsSchema,
  SMTP_SETTINGS_SCHEMA_VERSION,
  toSmtpConfig,
  type SmtpSettings,
  type SmtpSettingsUpdate,
} from '@/lib/mail/smtp-settings';

export type SmtpConfigurationDependencies = {
  store: SmtpSettingsStore;
  verify: (config: SmtpConfig) => Promise<SmtpVerificationResult>;
  logger: Logger;
  now: () => Date;
};

/** Also revalidates a replayed idempotent record, which is untyped JSON. */
export const smtpActivationResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('activated'),
    version: z.string().min(1).max(50),
    changed: z.array(z.string().max(50)).max(20),
  }),
  z.object({ status: z.literal('not_provisioned') }),
  z.object({ status: z.literal('password_required') }),
  z.object({ status: z.literal('no_rollback_target') }),
  z.object({
    status: z.literal('verification_failed'),
    failure: z.enum(SMTP_VERIFICATION_FAILURES),
  }),
]);

export type SmtpActivationResult = z.infer<typeof smtpActivationResultSchema>;

/**
 * Verifies before it activates: an unusable host, TLS mode, or credential never
 * reaches Secret Manager, so the newest version is always one that authenticated.
 */
async function verifyAndActivate(
  dependencies: SmtpConfigurationDependencies,
  settings: SmtpSettings,
  previous: SmtpSettings | null,
  actorId: string,
): Promise<SmtpActivationResult> {
  const verification = await dependencies.verify(toSmtpConfig(settings));
  if (!verification.ok) {
    dependencies.logger.warn('smtp configuration verification failed', {
      actorId,
      failure: verification.failure,
    });
    return { status: 'verification_failed', failure: verification.failure };
  }
  const version = await dependencies.store.activate({
    schemaVersion: SMTP_SETTINGS_SCHEMA_VERSION,
    settings,
    updatedAt: dependencies.now().toISOString(),
    updatedBy: actorId,
  });
  if (!version) return { status: 'not_provisioned' };
  const changed = changedSettingFields(previous, settings);
  dependencies.logger.info('smtp configuration activated', { actorId, version, fields: changed });
  return { status: 'activated', version, changed };
}

/** An omitted password keeps the active one, so it never travels to the browser. */
export async function activateSmtpSettings(
  dependencies: SmtpConfigurationDependencies,
  input: { update: SmtpSettingsUpdate; actorId: string },
): Promise<SmtpActivationResult> {
  const state = await dependencies.store.load();
  if (state.status === 'missing') return { status: 'not_provisioned' };
  const previous = state.status === 'active' ? state.stored.settings : null;
  const password = input.update.password ?? previous?.password;
  if (!password) return { status: 'password_required' };
  const settings = smtpSettingsSchema.parse({ ...input.update, password });
  return verifyAndActivate(dependencies, settings, previous, input.actorId);
}

/** Re-activates the retained last-known-good version as a new version. */
export async function rollbackSmtpSettings(
  dependencies: SmtpConfigurationDependencies,
  input: { actorId: string },
): Promise<SmtpActivationResult> {
  const state = await dependencies.store.load();
  if (state.status === 'missing') return { status: 'not_provisioned' };
  if (state.status !== 'active' || !state.previous) return { status: 'no_rollback_target' };
  return verifyAndActivate(
    dependencies,
    state.previous.settings,
    state.stored.settings,
    input.actorId,
  );
}
