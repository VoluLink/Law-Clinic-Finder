import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { requestEmailChange, type EmailChangeRequestResult } from '@/lib/auth/email-change';
import { sendEmailChangeLink } from '@/lib/auth/email-change-link';
import { firebaseEmailChangeStore } from '@/lib/firebase/email-change-store';
import { emailValue } from '@/lib/forms/email';
import { requestLogger } from '@/lib/http/request-id';

const bodySchema = z.object({ email: emailValue });

const FAILURES: Record<
  Exclude<EmailChangeRequestResult['status'], 'sent'>,
  { error: string; status: number; code?: string }
> = {
  reauth_required: {
    error: 'Bitte melde dich erneut an und versuche es dann noch einmal.',
    status: 401,
    code: 'reauth_required',
  },
  same_email: { error: 'Das ist bereits deine aktuelle E-Mail-Adresse.', status: 400 },
  email_taken: { error: 'Diese E-Mail-Adresse wird bereits verwendet.', status: 409 },
  error: { error: 'E-Mail-Änderung fehlgeschlagen.', status: 502 },
};

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }
  if (!guard.email || guard.authTime === null) return failureResponse('reauth_required');
  let result: EmailChangeRequestResult;
  try {
    result = await requestEmailChange(
      {
        ...firebaseEmailChangeStore,
        sendVerification: (userId, currentEmail, newEmail) =>
          sendEmailChangeLink({ userId, currentEmail, newEmail }),
      },
      {
        userId: guard.userId,
        currentEmail: guard.email,
        newEmail: parsed.data.email,
        authTime: guard.authTime,
      },
    );
  } catch (error) {
    logger.error('admin email change failed', { reason: errorMessage(error) });
    return failureResponse('error');
  }
  if (result.status === 'sent') return Response.json({ ok: true });
  if (result.status === 'error') logger.warn('admin email change delivery failed');
  return failureResponse(result.status);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

function failureResponse(status: Exclude<EmailChangeRequestResult['status'], 'sent'>): Response {
  const failure = FAILURES[status];
  return Response.json(
    { error: failure.error, ...(failure.code ? { code: failure.code } : {}) },
    { status: failure.status },
  );
}
