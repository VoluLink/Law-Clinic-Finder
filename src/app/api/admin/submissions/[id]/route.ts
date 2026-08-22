import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { approveAccess, rejectAccess } from '@/lib/admin/approve-access';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseAccessReviewStore } from '@/lib/firebase/access-review-store';
import { firebaseClinicAccessStore } from '@/lib/firebase/revoke-clinic-access';
import { requestLogger } from '@/lib/http/request-id';

type RouteContext = { params: Promise<{ id: string }> };

async function clinicIdFrom(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.uuid().safeParse(id).success ? id : null;
}

function respond(status: 'ok' | 'not_found' | 'error', failure: string): Response {
  if (status === 'not_found') return Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  if (status === 'error') return Response.json({ error: failure }, { status: 500 });
  return Response.json({ status: 'ok' });
}

/** Approve: the entry joins the directory and its login becomes active. */
export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });

  const deps = {
    reviewStore: firebaseAccessReviewStore,
    accessStore: firebaseClinicAccessStore,
    logger,
  };
  const result = await approveAccess(deps, clinicId);
  return respond(result.status, 'Freischalten fehlgeschlagen.');
}

/** Reject: remove the login and free the claim slot. */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });

  const deps = {
    reviewStore: firebaseAccessReviewStore,
    accessStore: firebaseClinicAccessStore,
    logger,
  };
  const result = await rejectAccess(deps, clinicId);
  return respond(result.status, 'Ablehnen fehlgeschlagen.');
}
