import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { publicSupabaseEnv } from './env';

/** Session-bound client for Server Components and route handlers. */
export async function createSupabaseServerClient() {
  const store = await cookies();
  const { url, anonKey } = publicSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Expected in Server Component renders, which cannot write cookies;
          // the proxy (loadProxySession) persists refreshed tokens instead.
        }
      },
    },
  });
}
