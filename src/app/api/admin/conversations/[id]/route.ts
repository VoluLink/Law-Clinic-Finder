import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

// GDPR erasure: RLS grants admins delete on conversations.
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  const { error } = await guard.supabase.from('conversations').delete().eq('id', id);
  if (error) {
    logger.error('conversation delete failed', { reason: error.message });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
