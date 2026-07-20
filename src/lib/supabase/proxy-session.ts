import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { publicSupabaseEnv } from './env';

const roleSchema = z.enum(['admin', 'clinic']);

export type AppRole = z.infer<typeof roleSchema>;
export type ProxySession = { response: NextResponse; role: AppRole | null };

/**
 * Refreshes the auth session inside src/proxy.ts and resolves the caller's
 * role. setAll must write to BOTH the request and a fresh response so
 * refreshed tokens reach the browser (per @supabase/ssr contract).
 */
export async function loadProxySession(request: NextRequest): Promise<ProxySession> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = publicSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { response, role: null };

  const { data: profile } = await supabase.from('profiles').select('role').maybeSingle();
  const parsed = roleSchema.safeParse(profile?.role);
  return { response, role: parsed.success ? parsed.data : null };
}
