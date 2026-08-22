/**
 * Next.js startup hook. Runs once per server instance, before the app handles
 * requests. Here it wires the process-wide logger to also persist lines into
 * Firestore for the admin "Protokolle" viewer.
 *
 * Dynamic imports keep the server-only Firebase Admin SDK out of the Edge
 * runtime and out of the test graph — nothing imports this file except Next.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const [{ createLogStore }, { firebaseLogRepository }, { setLogSink }] = await Promise.all([
    import('@/lib/logs/log-store'),
    import('@/lib/firebase/log-repository'),
    import('@/lib/logger'),
  ]);

  const store = createLogStore({ repository: firebaseLogRepository });
  setLogSink(store.persist);
}
