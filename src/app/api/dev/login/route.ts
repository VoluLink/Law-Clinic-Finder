import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { buildConfirmPath, ensureDevSession, parseDevLoginRole } from '@/lib/dev/dev-login';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Dev-only: signs in one of the two seeded @example.com accounts without the
 * email round-trip. Gated by `parseDevLoginRole` (production and the missing
 * opt-in flag both yield null) and answers 404 rather than 403 — a route that
 * must not exist should not advertise that it does.
 *
 * It mints nothing itself: it hands a normal magic-link token to the existing
 * /auth/confirm handler, so the session is established by the same verified
 * path a real login uses.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const role = parseDevLoginRole(request.nextUrl.searchParams.get('as'));
  if (!role) return new Response('Not Found', { status: 404 });
  const token = await ensureDevSession(createSupabaseAdminClient(), role);
  redirect(buildConfirmPath(token));
}
