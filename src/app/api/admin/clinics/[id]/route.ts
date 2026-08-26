import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminRoute, requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { clinicAdminSchema } from '@/lib/clinics/schema';
import { toRequiredLabels } from '@/lib/clinics/publish-requirements';
import {
  deleteAdminClinic,
  updateAdminClinic,
  type AdminClinicUpdateResult,
} from '@/lib/firebase/admin-clinic-store';
import { ClinicNameConflictError } from '@/lib/firebase/clinic-repository';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import type { Logger } from '@/lib/logger';
import { sendClinicPublishedNotice } from '@/lib/mail/clinic-notifications';

type RouteContext = { params: Promise<{ id: string }> };

async function clinicIdFrom(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.uuid().safeParse(id).success ? id : null;
}

export function updateFailureResponse(result: AdminClinicUpdateResult): Response | null {
  if (result.status === 'ok') return null;
  if (result.status === 'not_found') {
    return Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  }
  const missing = result.status === 'incomplete' ? toRequiredLabels(result.missing) : [];
  const error =
    result.status === 'unapproved'
      ? 'Der Eintrag muss zuerst freigegeben werden.'
      : `Zum Veröffentlichen fehlt noch: ${missing.join(', ')}.`;
  return Response.json({ error }, { status: 422 });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = clinicAdminSchema.partial().safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  try {
    const result = await updateAdminClinic(clinicId, parsed.data);
    const failed = updateFailureResponse(result);
    if (failed) return failed;
    if (result.status === 'ok' && result.notifyPublication) {
      await sendClinicPublishedNotice(clinicId, logger);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return updateErrorResponse(error, clinicId, logger);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  try {
    const deleted = await deleteAdminClinic(clinicId);
    return deleted
      ? Response.json({ ok: true })
      : Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  } catch (error) {
    logger.error('admin clinic delete failed', { clinicId, reason: errorMessage(error) });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
}

function updateErrorResponse(error: unknown, clinicId: string, logger: Logger): Response {
  if (error instanceof ClinicNameConflictError) {
    return Response.json({ error: 'Dieser Name wird bereits verwendet.' }, { status: 409 });
  }
  logger.error('admin clinic update failed', { clinicId, reason: errorMessage(error) });
  return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
