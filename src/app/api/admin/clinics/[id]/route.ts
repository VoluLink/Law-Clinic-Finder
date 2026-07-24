import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { clinicAdminSchema } from '@/lib/clinics/schema';
import {
  publishBlockers,
  REQUIREMENT_COLUMNS,
  toRequiredLabels,
  type ClinicRequirementFields,
} from '@/lib/clinics/publish-requirements';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

async function clinicIdFrom(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.uuid().safeParse(id).success ? id : null;
}

// Publishing requires a complete entry. Merge the incoming edits over the stored
// row and refuse (422) when a required field is still blank. Exported for tests.
export async function publishBlock(
  client: ReturnType<typeof createSupabaseAdminClient>,
  clinicId: string,
  incoming: Partial<ClinicRequirementFields> & { is_published?: boolean },
): Promise<Response | null> {
  const { data } = await client
    .from('clinics')
    .select(REQUIREMENT_COLUMNS)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) return Response.json({ error: 'Nicht gefunden.' }, { status: 404 });
  const missing = toRequiredLabels(
    publishBlockers({ ...(data as ClinicRequirementFields), ...incoming }),
  );
  if (missing.length === 0) return null;
  return Response.json(
    { error: `Zum Veröffentlichen fehlt noch: ${missing.join(', ')}.` },
    { status: 422 },
  );
}

// Service client on purpose: column grants keep is_published away from
// session-client updates; the admin role was re-checked by the guard.
export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = clinicAdminSchema.partial().safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  const adminClient = createSupabaseAdminClient();
  if (parsed.data.is_published === true) {
    const blocked = await publishBlock(adminClient, clinicId, parsed.data);
    if (blocked) return blocked;
  }
  const { error } = await adminClient.from('clinics').update(parsed.data).eq('id', clinicId);
  if (error) {
    logger.error('admin clinic update failed', { clinicId, reason: error.message });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const clinicId = await clinicIdFrom(context);
  if (!clinicId) return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  const adminClient = createSupabaseAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('user_id')
    .eq('clinic_id', clinicId)
    .maybeSingle();
  if (profile?.user_id) await adminClient.auth.admin.deleteUser(profile.user_id);
  const { error } = await adminClient.from('clinics').delete().eq('id', clinicId);
  if (error) {
    logger.error('admin clinic delete failed', { clinicId, reason: error.message });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
