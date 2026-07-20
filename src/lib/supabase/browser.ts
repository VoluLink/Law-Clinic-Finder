import { createBrowserClient } from '@supabase/ssr';

import { publicSupabaseEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
