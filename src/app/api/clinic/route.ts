import type { NextRequest } from 'next/server';

import { AuthError, requireActiveRole } from '@/lib/auth/require-role';
import { clinicMemberSaveSchema } from '@/lib/clinics/schema';
import { ClinicNameConflictError, saveMemberClinic } from '@/lib/firebase/clinic-repository';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';
import { sendClinicSubmissionNotice } from '@/lib/mail/clinic-notifications';

export async function PATCH(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  try {
    const profile = await requireActiveRole(['clinic']);
    if (!profile.clinic_id) return Response.json({ error: 'Nicht berechtigt.' }, { status: 403 });
    const body = await readJsonBody(request);
    if (!body.ok) return bodyRejectionResponse(body.reason);
    const parsed = clinicMemberSaveSchema.safeParse(body.value);
    if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
    const saved = await saveMemberClinic(profile.clinic_id, parsed.data);
    if (saved.notifySubmission) await sendClinicSubmissionNotice(profile.clinic_id, logger);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: 'Nicht berechtigt.' }, { status: error.status });
    }
    if (error instanceof ClinicNameConflictError) {
      return Response.json({ error: 'Dieser Name wird bereits verwendet.' }, { status: 409 });
    }
    logger.error('clinic update failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}
