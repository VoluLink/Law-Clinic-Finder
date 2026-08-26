import { redirect } from 'next/navigation';

import { firebaseAdminAuth } from '@/lib/firebase/admin';
import { clearFirebaseSession, readSessionCookie } from '@/lib/firebase/session';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';
import type { Logger } from '@/lib/logger';

/**
 * Clearing the cookie only stops the browser from sending it; a copy taken
 * beforehand stays valid until it expires. Revoking the refresh tokens makes
 * `verifySessionCookie(cookie, true)` reject every session issued before this
 * moment, which is what "sign out" has to mean if the reason for signing out
 * was a shared or lost device.
 *
 * It signs the account out everywhere, including the person's other devices.
 * That is the accepted trade-off (DECISION A): the alternative needs a
 * per-session denylist with its own state, lookups and cleanup.
 */
async function revokeSessions(userId: string, logger: Logger): Promise<void> {
  try {
    await firebaseAdminAuth().revokeRefreshTokens(userId);
  } catch (error) {
    // The cookie is cleared either way; log so a persistently failing revocation
    // is visible rather than silently leaving old sessions alive.
    logger.error('session revocation failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  const session = await readSessionCookie();
  if (session) await revokeSessions(session.uid, logger);
  await clearFirebaseSession();
  logger.info('signed out', { userId: session?.uid ?? null });
  redirect('/login');
}
