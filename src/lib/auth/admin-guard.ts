import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AuthError, requireRole } from './require-role';

type GuardResult = { supabase: SupabaseClient } | { response: Response };

/** Shared guard for /api/admin/* routes: session client + admin re-check. */
export async function requireAdminRoute(): Promise<GuardResult> {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
    return { supabase };
  } catch (error) {
    if (error instanceof AuthError) {
      return { response: Response.json({ error: 'Nicht berechtigt.' }, { status: error.status }) };
    }
    throw error;
  }
}
