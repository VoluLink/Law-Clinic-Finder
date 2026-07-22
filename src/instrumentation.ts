/**
 * Next.js startup hook. Runs once per server instance, before the app handles
 * requests. Here it wires the process-wide logger to also persist lines into
 * `public.logs` for the admin "Protokolle" viewer.
 *
 * Dynamic imports keep the server-only Supabase admin client out of the Edge
 * runtime and out of the test graph — nothing imports this file except Next.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.SUPABASE_SECRET_KEY) return;

  const [{ createLogStore }, { createSupabaseAdminClient }, { setLogSink }] = await Promise.all([
    import('@/lib/logs/log-store'),
    import('@/lib/supabase/admin'),
    import('@/lib/logger'),
  ]);

  const store = createLogStore({ client: createSupabaseAdminClient() });
  setLogSink(store.persist);
}
