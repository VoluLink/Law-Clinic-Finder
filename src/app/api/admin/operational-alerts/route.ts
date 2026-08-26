import { z } from 'zod';

import { listAdmins } from '@/lib/admin/manage-admins';
import { selectOperationalAlertRecipient } from '@/lib/admin/operational-alerts';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { firebaseUidSchema } from '@/lib/firebase/identity-reservations';
import { firebaseOperationalAlertStore } from '@/lib/firebase/operational-alert-store';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';

const requestSchema = z.object({ userId: firebaseUidSchema }).strict();

export async function PUT(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  const result = await selectOperationalAlertRecipient(
    admins,
    firebaseOperationalAlertStore,
    parsed.data.userId,
    logger,
  );
  if (result.status === 'invalid_admin') {
    return Response.json({ error: 'Aktiver Admin nicht gefunden.' }, { status: 409 });
  }
  if (result.status === 'error') {
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ status: 'ok' });
}
