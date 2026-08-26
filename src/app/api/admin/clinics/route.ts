import type { NextRequest } from 'next/server';

import { inviteClinic } from '@/lib/admin/invite-clinic';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { clinicInviteSchema } from '@/lib/clinics/schema';
import { listAdminClinics } from '@/lib/firebase/admin-clinic-store';
import { firebaseClinicInviteStore } from '@/lib/firebase/clinic-invite-store';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';

export async function GET(request?: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  try {
    return Response.json({ clinics: await listAdminClinics() });
  } catch (error) {
    logger.error('admin clinic list failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = clinicInviteSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  const result = await inviteClinic({ store: firebaseClinicInviteStore, logger }, parsed.data);
  if (result.status === 'error') {
    return Response.json({ error: 'Einladen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(result, { status: result.status === 'ok' ? 201 : 200 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
