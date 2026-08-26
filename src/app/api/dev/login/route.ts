import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { exchangeEmailLink } from '@/lib/auth/identity-toolkit';
import { ensureDevSession, parseDevLoginRole } from '@/lib/dev/dev-login';
import { firebaseDevLoginStore } from '@/lib/firebase/dev-login-store';
import { createSessionCookie } from '@/lib/firebase/session';

/**
 * Dev-only: signs in one of the two seeded @example.com accounts without the
 * email round-trip. Gated by `parseDevLoginRole` (production and the missing
 * opt-in flag both yield null) and answers 404 rather than 403 — a route that
 * must not exist should not advertise that it does.
 *
 * Both Firebase emulators must also point to loopback, so this route cannot
 * create privileged fixtures in a real Firebase project.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const role = parseDevLoginRole(request.nextUrl.searchParams.get('as'));
  if (!role) return new Response('Not Found', { status: 404 });
  const devSession = await ensureDevSession(firebaseDevLoginStore, role);
  const exchanged = await exchangeEmailLink(devSession.email, devSession.actionCode);
  if (exchanged.userId !== devSession.userId) throw new Error('dev identity mismatch');
  await createSessionCookie(exchanged.idToken, role);
  redirect(devSession.destination);
}
