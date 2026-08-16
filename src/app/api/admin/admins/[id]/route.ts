import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { removeAdmin } from '@/lib/admin/manage-admins';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

const FAILURES: Record<string, { message: string; status: number }> = {
  self: { message: 'Du kannst dein eigenes Konto nicht entfernen.', status: 409 },
  last_admin: { message: 'Das letzte Admin-Konto kann nicht entfernt werden.', status: 409 },
  not_found: { message: 'Nicht gefunden.', status: 404 },
  error: { message: 'Entfernen fehlgeschlagen.', status: 500 },
};

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const result = await removeAdmin(
    { adminClient: createSupabaseAdminClient(), logger },
    id,
    guard.userId,
  );
  const failure = FAILURES[result.status];
  if (failure) return Response.json({ error: failure.message }, { status: failure.status });
  return Response.json({ status: 'ok' });
}
