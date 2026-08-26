import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { deleteConversation } from '@/lib/firebase/conversation-store';
import { requestLogger } from '@/lib/http/request-id';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  try {
    await deleteConversation(id);
  } catch (error) {
    logger.error('conversation delete failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
