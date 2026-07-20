import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { approveSubmission, rejectSubmission } from '@/lib/admin/approve-submission';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

async function submissionIdFrom(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.uuid().safeParse(id).success ? id : null;
}

/** Approve: insert as published clinic + send the access invite. */
export async function POST(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const submissionId = await submissionIdFrom(context);
  if (!submissionId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });

  const result = await approveSubmission(
    { adminClient: createSupabaseAdminClient(), logger },
    submissionId,
  );
  if (result.status === 'not_found') {
    return Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  }
  if (result.status === 'error') {
    return Response.json({ error: 'Freischalten fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(result);
}

/** Reject: discard the submission. */
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const submissionId = await submissionIdFrom(context);
  if (!submissionId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });

  const deleted = await rejectSubmission(
    { adminClient: createSupabaseAdminClient(), logger },
    submissionId,
  );
  if (!deleted) return Response.json({ error: 'Ablehnen fehlgeschlagen.' }, { status: 500 });
  return Response.json({ status: 'rejected' });
}
