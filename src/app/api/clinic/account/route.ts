import { AuthError, requireRole } from '@/lib/auth/require-role';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// A clinic member deletes its own account: the login is removed and the entry
// is unpublished (hidden from the finder), but the directory row is kept so an
// admin can re-invite later. Publishing/deleting the auth user needs the
// service client, so ownership is proven via requireRole first.
export async function DELETE(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  try {
    const profile = await requireRole(supabase, ['clinic']);
    if (!profile.clinic_id) return Response.json({ error: 'Nicht berechtigt.' }, { status: 403 });
    await revokeClinicAccess(createSupabaseAdminClient(), profile.clinic_id, {
      unpublish: true,
      clearContactEmail: false,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: 'Nicht berechtigt.' }, { status: error.status });
    }
    logger.error('clinic self-delete failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Konto löschen fehlgeschlagen.' }, { status: 500 });
  }
}
