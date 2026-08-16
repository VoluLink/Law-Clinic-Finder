import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AuthError, requireRole } from './require-role';

type GuardResult = { supabase: SupabaseClient; userId: string } | { response: Response };

/** Shared guard for /api/admin/* routes: session client + admin re-check. The
 *  caller's own id comes back with it, so a route can tell "this admin" from
 *  "another admin" — the self-removal guard depends on that distinction. */
export async function requireAdminRoute(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : '';
    return { supabase, userId };
  } catch (error) {
    if (error instanceof AuthError) {
      return { response: Response.json({ error: 'Nicht berechtigt.' }, { status: error.status }) };
    }
    throw error;
  }
}
