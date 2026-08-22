import 'server-only';

import { smtpConfig, type SmtpConfig } from '@/lib/firebase/env';
import { firebaseSmtpSettingsStore } from '@/lib/firebase/smtp-settings-store';
import { logger as defaultLogger, type Logger } from '@/lib/logger';

import type { SmtpSettingsStore } from './settings-store';
import { createSmtpMailer, type Mailer } from './smtp';
import { toSmtpConfig } from './smtp-settings';

/** One brief read per warm instance keeps Secret Manager access operations —
 *  and their cost — proportional to instances, not to sent messages. */
const CACHE_MS = 5 * 60 * 1_000;

type Cache = { expiresAt: number; config: SmtpConfig };

let cache: Cache | null = null;
/** Survives cache expiry so a transient Secret Manager failure keeps sending
 *  with the last activated configuration instead of a stale environment one. */
let lastActivated: SmtpConfig | null = null;

export function resetActiveSmtpConfigCache(): void {
  cache = null;
  lastActivated = null;
}

/** True when the deployment still carries a usable SMTP environment fallback. */
export function hasEnvironmentSmtpConfig(): boolean {
  try {
    smtpConfig();
    return true;
  } catch {
    return false;
  }
}

export type ActiveConfigDependencies = {
  store: SmtpSettingsStore;
  logger: Logger;
  now: () => number;
};

function defaultDependencies(): ActiveConfigDependencies {
  return { store: firebaseSmtpSettingsStore, logger: defaultLogger, now: Date.now };
}

async function readActivated(deps: ActiveConfigDependencies): Promise<SmtpConfig | null> {
  try {
    const stored = await deps.store.readActive();
    return stored ? toSmtpConfig(stored.settings) : null;
  } catch (error) {
    deps.logger.warn('smtp configuration read failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}

/**
 * Precedence: the activated secret payload, then the last one this instance
 * read successfully, then the deployment environment. Fails loudly only when no
 * source at all is configured.
 */
export async function activeSmtpConfig(
  dependencies: Partial<ActiveConfigDependencies> = {},
): Promise<SmtpConfig> {
  const deps = { ...defaultDependencies(), ...dependencies };
  const now = deps.now();
  if (cache && cache.expiresAt > now) return cache.config;
  const activated = await readActivated(deps);
  if (activated) {
    cache = { expiresAt: now + CACHE_MS, config: activated };
    lastActivated = activated;
    return activated;
  }
  return lastActivated ?? smtpConfig();
}

/** Mailer bound to the currently active configuration. */
export async function activeMailer(
  dependencies: Partial<ActiveConfigDependencies> = {},
): Promise<Mailer> {
  return createSmtpMailer(await activeSmtpConfig(dependencies));
}
