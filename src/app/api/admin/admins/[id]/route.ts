import type { NextRequest } from 'next/server';

import { listAdmins, removeAdmin } from '@/lib/admin/manage-admins';
import { reconcileOperationalAlertRecipient } from '@/lib/admin/operational-alerts';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { firebaseUidSchema } from '@/lib/firebase/identity-reservations';
import { firebaseOperationalAlertStore } from '@/lib/firebase/operational-alert-store';
import { requestLogger } from '@/lib/http/request-id';

type RouteContext = { params: Promise<{ id: string }> };

const FAILURES: Record<string, { message: string; status: number }> = {
  self: { message: 'Du kannst dein eigenes Konto nicht entfernen.', status: 409 },
  last_admin: { message: 'Das letzte Admin-Konto kann nicht entfernt werden.', status: 409 },
  not_found: { message: 'Nicht gefunden.', status: 404 },
  error: { message: 'Entfernen fehlgeschlagen.', status: 500 },
};

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!firebaseUidSchema.safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const result = await removeAdmin({ store: firebaseAdminAccountStore, logger }, id, guard.userId);
  const failure = FAILURES[result.status];
  if (failure) return Response.json({ error: failure.message }, { status: failure.status });
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  await reconcileOperationalAlertRecipient(admins, firebaseOperationalAlertStore, logger);
  return Response.json({ status: 'ok' });
}
