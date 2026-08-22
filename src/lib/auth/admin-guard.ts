import { AuthError, requireRole } from './require-role';
import { isSameOrigin } from '../http/same-origin';

type GuardResult =
  { userId: string; email: string | null; authTime: number | null } | { response: Response };

/** Shared guard for /api/admin/* routes: session client + admin re-check. The
 *  caller's own id comes back with it, so a route can tell "this admin" from
 *  "another admin" — the self-removal guard depends on that distinction. */
export async function requireAdminRoute(request?: Request): Promise<GuardResult> {
  if (request && !isSameOrigin(request)) {
    return { response: Response.json({ error: 'Nicht erlaubt.' }, { status: 403 }) };
  }
  try {
    const profile = await requireRole(['admin']);
    return {
      userId: profile.user_id,
      email: profile.email ?? null,
      authTime: profile.auth_time ?? null,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return { response: Response.json({ error: 'Nicht berechtigt.' }, { status: error.status }) };
    }
    throw error;
  }
}
