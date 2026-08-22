import 'server-only';

import { firebaseIdempotencyStore } from '@/lib/firebase/idempotency-store';
import { runIdempotent } from '@/lib/http/idempotency';
import type { Logger } from '@/lib/logger';
import { resetActiveSmtpConfigCache } from '@/lib/mail/active-config';
import { verifySmtpConfig } from '@/lib/mail/smtp';
import { firebaseSmtpSettingsStore } from '@/lib/firebase/smtp-settings-store';

import { guardSmtpChange, smtpActivationResponse } from './smtp-change-request';
import {
  smtpActivationResultSchema,
  type SmtpActivationResult,
  type SmtpConfigurationDependencies,
} from './smtp-configuration';

type Caller = { userId: string; authTime: number | null };

type Change = (
  dependencies: SmtpConfigurationDependencies,
  actorId: string,
) => Promise<SmtpActivationResult>;

function dependencies(logger: Logger): SmtpConfigurationDependencies {
  return {
    store: firebaseSmtpSettingsStore,
    verify: (config) => verifySmtpConfig(config),
    logger,
    now: () => new Date(),
  };
}

/** Shared pipeline for both configuration changes: guard, run at most once,
 *  refresh this instance's cache, and answer without leaking a secret. */
export async function runSmtpChange(
  request: Request,
  caller: Caller,
  logger: Logger,
  change: Change,
): Promise<Response> {
  const context = guardSmtpChange(request, caller);
  if ('response' in context) return context.response;
  try {
    const outcome = await runIdempotent(
      firebaseIdempotencyStore,
      context.storeKey,
      context.expiresAt,
      () => change(dependencies(logger), context.actorId),
      (result) => result.status === 'activated',
    );
    if (outcome.status === 'in_progress') {
      return Response.json({ error: 'Die Änderung wird bereits verarbeitet.' }, { status: 409 });
    }
    return respond(smtpActivationResultSchema.parse(outcome.result));
  } catch (error) {
    logger.error('smtp configuration change failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}

function respond(result: SmtpActivationResult): Response {
  if (result.status === 'activated') resetActiveSmtpConfigCache();
  return smtpActivationResponse(result);
}
