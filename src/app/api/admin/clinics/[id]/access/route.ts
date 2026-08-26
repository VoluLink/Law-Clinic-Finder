import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { firebaseClinicAccessStore } from '@/lib/firebase/revoke-clinic-access';
import { requestLogger } from '@/lib/http/request-id';

type RouteContext = { params: Promise<{ id: string }> };

// Reset a clinic's member access: delete the linked auth user and clear the
// contact/login email, while preserving the directory publication state.
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  try {
    await revokeClinicAccess(firebaseClinicAccessStore, id, {
      unpublish: false,
      clearContactEmail: true,
    });
  } catch (error) {
    logger.error('clinic access reset failed', {
      clinicId: id,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Zugang zurücksetzen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
