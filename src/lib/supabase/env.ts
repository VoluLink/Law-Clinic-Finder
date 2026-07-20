export type PublicSupabaseEnv = { url: string; anonKey: string };

/**
 * Literal process.env member access is required so Next.js can inline the
 * values into client bundles — never replace with dynamic lookups.
 */
export function publicSupabaseEnv(): PublicSupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
