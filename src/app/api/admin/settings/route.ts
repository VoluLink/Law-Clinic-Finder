import type { NextRequest } from 'next/server';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { chatSettingsUpdateSchema, readAssistantFormView } from '@/lib/settings';

export async function GET(): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { data, error } = await guard.supabase.from('settings').select('key, value');
  if (error) {
    logger.error('settings load failed', { reason: error.message });
    return Response.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json(readAssistantFormView(data ?? []));
}

export async function PUT(request: NextRequest): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = chatSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  // The settings table is the live source of truth; each field is written as its
  // own row, so an admin edit takes effect for every visitor on the next request.
  const rows = Object.entries(parsed.data).map(([key, value]) => ({ key, value }));
  const { error } = await guard.supabase.from('settings').upsert(rows);
  if (error) {
    logger.error('settings update failed', { reason: error.message });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
