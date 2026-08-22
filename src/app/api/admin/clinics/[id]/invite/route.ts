import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { reinviteClinic } from '@/lib/admin/invite-clinic';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseClinicInviteStore } from '@/lib/firebase/clinic-invite-store';
import { requestLogger } from '@/lib/http/request-id';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  const result = await reinviteClinic({ store: firebaseClinicInviteStore, logger }, id);
  if (result.status === 'error') {
    return Response.json({ error: 'Einladen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(result);
}
