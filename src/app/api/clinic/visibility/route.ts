import type { NextRequest } from 'next/server';

import { AuthError, requireActiveRole } from '@/lib/auth/require-role';
import { toRequiredLabels } from '@/lib/clinics/publish-requirements';
import {
  isWithinAllowedRange,
  MAX_HIDDEN_DAYS,
  visibilityRequestSchema,
  visibilityUpdate,
  type VisibilityRequest,
} from '@/lib/clinics/visibility';
import { setClinicVisibility, type VisibilityResult } from '@/lib/firebase/clinic-visibility-store';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';

function failureResponse(result: VisibilityResult): Response | null {
  if (result.status === 'ok') return null;
  if (result.status === 'not_found') {
    return Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  }
  if (result.status === 'unapproved') {
    return Response.json({ error: 'Der Eintrag ist noch nicht freigegeben.' }, { status: 422 });
  }
  const missing = toRequiredLabels(result.missing).join(', ');
  return Response.json({ error: `Zum Veröffentlichen fehlt noch: ${missing}.` }, { status: 422 });
}

function outOfRange(request: VisibilityRequest): boolean {
  return request.state === 'temporary' && !isWithinAllowedRange(request.until ?? '', new Date());
}

/** A clinic pauses or resumes its own listing. The clinic id comes only from the
 *  freshly loaded profile, never from the request body (AR-2). */
export async function PATCH(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  try {
    const profile = await requireActiveRole(['clinic']);
    if (!profile.clinic_id) return Response.json({ error: 'Nicht berechtigt.' }, { status: 403 });
    const body = await readJsonBody(request);
    if (!body.ok) return bodyRejectionResponse(body.reason);
    const parsed = visibilityRequestSchema.safeParse(body.value);
    if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
    if (outOfRange(parsed.data)) {
      return Response.json(
        {
          error: `Das Datum muss in der Zukunft und höchstens ${MAX_HIDDEN_DAYS} Tage entfernt sein.`,
        },
        { status: 400 },
      );
    }
    const result = await setClinicVisibility(profile.clinic_id, visibilityUpdate(parsed.data));
    return failureResponse(result) ?? Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: 'Nicht berechtigt.' }, { status: error.status });
    }
    logger.error('clinic visibility update failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}
