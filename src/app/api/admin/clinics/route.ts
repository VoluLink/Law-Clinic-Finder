import type { NextRequest } from 'next/server';

import { inviteClinic } from '@/lib/admin/invite-clinic';
import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { clinicInviteSchema } from '@/lib/clinics/schema';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const ADMIN_COLUMNS =
  'id, name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements, advises_clients, is_published, updated_at';

export async function GET(): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { data, error } = await createSupabaseAdminClient()
    .from('clinics')
    .select(ADMIN_COLUMNS)
    .order('name');
  if (error) {
    logger.error('admin clinic list failed', { reason: error.message });
    return Response.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ clinics: data });
}

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = clinicInviteSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  const result = await inviteClinic(
    { adminClient: createSupabaseAdminClient(), logger },
    parsed.data,
  );
  if (result.status === 'error') {
    return Response.json({ error: 'Einladen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(result, { status: result.status === 'ok' ? 201 : 200 });
}
