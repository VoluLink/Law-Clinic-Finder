import { AuthError, requireActiveRole } from '@/lib/auth/require-role';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { firebaseClinicAccessStore } from '@/lib/firebase/revoke-clinic-access';
import { clearFirebaseSession } from '@/lib/firebase/session';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';

// A clinic member deletes its own account: the login is removed and the entry
// is unpublished (hidden from the finder), but the directory row is kept so an
// admin can re-invite later. Publishing/deleting the auth user needs the
// service client, so ownership is proven via requireActiveRole first.
export async function DELETE(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  try {
    const profile = await requireActiveRole(['clinic']);
    if (!profile.clinic_id) return Response.json({ error: 'Nicht berechtigt.' }, { status: 403 });
    await revokeClinicAccess(firebaseClinicAccessStore, profile.clinic_id, {
      unpublish: true,
      clearContactEmail: false,
    });
    await clearFirebaseSession();
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
