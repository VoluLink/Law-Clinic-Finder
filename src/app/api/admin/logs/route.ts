import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

// Clears the log store on demand. RLS grants admins delete on logs; the
// gte filter is only there because PostgREST refuses an unfiltered delete.
export async function DELETE(): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { error } = await guard.supabase
    .from('logs')
    .delete()
    .gte('logged_at', new Date(0).toISOString());
  if (error) {
    logger.error('logs clear failed', { reason: error.message });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
