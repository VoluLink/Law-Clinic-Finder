import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { publicSupabaseEnv } from './env';

/**
 * Service-role client — bypasses RLS. Only for server-side flows that need
 * it: clinic invites, publish toggle, settings read in the chat route, and
 * conversation inserts. Never import from client components.
 */
export function createSupabaseAdminClient() {
  const { url } = publicSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error('Missing SUPABASE_SECRET_KEY');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
