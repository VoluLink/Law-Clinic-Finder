import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { reinviteClinic } from '@/lib/admin/invite-clinic';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  const result = await reinviteClinic({ adminClient: createSupabaseAdminClient(), logger }, id);
  if (result.status === 'error') {
    return Response.json({ error: 'Einladen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(result);
}
