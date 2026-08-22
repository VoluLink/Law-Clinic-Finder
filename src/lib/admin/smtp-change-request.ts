import { recentlyAuthenticated } from '@/lib/auth/recent-auth';
import { idempotencyKeySchema } from '@/lib/http/idempotency';
import { createRateLimiter, SMTP_SETTINGS_RATE_LIMIT } from '@/lib/rate-limit';
import type { SmtpVerificationFailure } from '@/lib/mail/smtp';

import type { SmtpActivationResult } from './smtp-configuration';

/** Long enough that a retried save replays instead of activating twice. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

const limiter = createRateLimiter(SMTP_SETTINGS_RATE_LIMIT);

export type SmtpChangeContext = { actorId: string; storeKey: string; expiresAt: Date };

type Caller = { userId: string; authTime: number | null };

/**
 * The three preconditions every configuration change shares: a bounded attempt
 * rate, a recent sign-in, and a caller-supplied idempotency key.
 */
export function guardSmtpChange(
  request: Request,
  caller: Caller,
  now: Date = new Date(),
): SmtpChangeContext | { response: Response } {
  if (limiter.isLimited(caller.userId, now.getTime())) {
    return { response: json('Zu viele Änderungen. Bitte später erneut versuchen.', 429) };
  }
  if (caller.authTime === null || !recentlyAuthenticated(caller.authTime, now)) {
    return { response: json('Bitte melde dich erneut an und versuche es dann noch einmal.', 401) };
  }
  const key = idempotencyKeySchema.safeParse(request.headers.get('idempotency-key'));
  if (!key.success) return { response: json('Fehlender oder ungültiger Idempotency-Key.', 400) };
  return {
    actorId: caller.userId,
    storeKey: `smtp-settings:${caller.userId}:${key.data}`,
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
  };
}

const VERIFICATION_MESSAGES: Record<SmtpVerificationFailure, string> = {
  authentication: 'Anmeldung am SMTP-Server fehlgeschlagen. Login oder Passwort prüfen.',
  connection: 'Der SMTP-Server ist unter Host und Port nicht erreichbar.',
  tls: 'Die gesicherte TLS-Verbindung kam nicht zustande. TLS-Modus und Port prüfen.',
  unknown: 'Die Prüfung der Einstellungen ist fehlgeschlagen.',
};

const FAILURE_RESPONSES: Record<
  Exclude<SmtpActivationResult['status'], 'activated' | 'verification_failed'>,
  { message: string; status: number }
> = {
  not_provisioned: { message: 'Das SMTP-Secret ist noch nicht eingerichtet.', status: 503 },
  password_required: { message: 'Für die erste Aktivierung ist ein Passwort nötig.', status: 400 },
  no_rollback_target: { message: 'Es gibt keine frühere geprüfte Konfiguration.', status: 409 },
};

/** The activated response carries no secret — only the version and field names. */
export function smtpActivationResponse(result: SmtpActivationResult): Response {
  if (result.status === 'activated') {
    return Response.json({ ok: true, version: result.version, changed: result.changed });
  }
  if (result.status === 'verification_failed') {
    return Response.json(
      { error: VERIFICATION_MESSAGES[result.failure], failure: result.failure },
      { status: 422 },
    );
  }
  const failure = FAILURE_RESPONSES[result.status];
  return json(failure.message, failure.status);
}

function json(error: string, status: number): Response {
  return Response.json({ error }, { status });
}
