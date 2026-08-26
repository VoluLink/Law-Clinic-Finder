import type { NextRequest } from 'next/server';

import { requireAdminRoute, requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseSettingsRepository } from '@/lib/firebase/settings-repository';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { chatSettingsUpdateSchema, readAssistantFormView } from '@/lib/settings';

export async function GET(request?: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  try {
    return Response.json(readAssistantFormView(await firebaseSettingsRepository.list()));
  } catch (error) {
    logger.error('settings load failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = chatSettingsUpdateSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  try {
    await firebaseSettingsRepository.updateEditable(parsed.data);
  } catch (error) {
    logger.error('settings update failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
