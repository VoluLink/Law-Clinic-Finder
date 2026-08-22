import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { inviteAdmin, listAdmins } from '@/lib/admin/manage-admins';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { requestLogger } from '@/lib/http/request-id';

const inviteSchema = z.object({ email: z.email() });

const FAILURES: Record<string, { message: string; status: number }> = {
  email_taken: { message: 'Diese E-Mail-Adresse wird bereits verwendet.', status: 409 },
  invite_failed: { message: 'Einladung konnte nicht gesendet werden.', status: 502 },
  error: { message: 'Einladung fehlgeschlagen.', status: 500 },
};

export async function GET(request?: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  return Response.json({ admins });
}

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const result = await inviteAdmin({ store: firebaseAdminAccountStore, logger }, parsed.data.email);
  const failure = FAILURES[result.status];
  if (failure) return Response.json({ error: failure.message }, { status: failure.status });
  return Response.json({ status: 'ok' });
}
