import type { NextRequest } from 'next/server';

import { AuthError, requireRole } from '@/lib/auth/require-role';
import { clinicEditableSchema } from '@/lib/clinics/schema';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  try {
    const profile = await requireRole(supabase, ['clinic']);
    if (!profile.clinic_id) return Response.json({ error: 'Nicht berechtigt.' }, { status: 403 });
    const body = await request.json().catch(() => null);
    const parsed = clinicEditableSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
    const { error } = await supabase
      .from('clinics')
      .update(parsed.data)
      .eq('id', profile.clinic_id);
    if (error) {
      logger.error('clinic update failed', { reason: error.message });
      return Response.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: 'Nicht berechtigt.' }, { status: error.status });
    }
    throw error;
  }
}
