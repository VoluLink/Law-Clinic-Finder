import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { brandingSchema, loadBranding } from '@/lib/branding/branding';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  return Response.json({ branding: await loadBranding(guard.supabase) });
}

export async function PUT(request: Request): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  const { error } = await createSupabaseAdminClient()
    .from('branding')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) {
    logger.error('branding update failed', { reason: error.message });
    return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
