import { recentlyAuthenticated } from './recent-auth';
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

/**
 * Extra gate for the admin actions that change who has power or destroy data:
 * adding and removing admins, deleting a clinic, its access, a transcript or a
 * log, changing the alert recipient, and editing the assistant's settings.
 *
 * A five-day session is convenient but it means a cookie stolen on Monday can
 * still add an admin on Friday. Requiring a sign-in within the last few minutes
 * bounds that to the moment of the theft. Reads and ordinary clinic editing are
 * deliberately left alone — friction everywhere trains people to click through
 * it.
 */
export async function requirePrivilegedAdminRoute(
  request?: Request,
  now: Date = new Date(),
): Promise<GuardResult> {
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard;
  if (guard.authTime === null || !recentlyAuthenticated(guard.authTime, now)) {
    return { response: reauthResponse() };
  }
  return guard;
}

function reauthResponse(): Response {
  return Response.json(
    {
      error: 'Bitte melde dich neu an, um diese Aktion auszuführen.',
      code: 'reauth_required',
    },
    { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
