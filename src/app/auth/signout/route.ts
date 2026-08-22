import { redirect } from 'next/navigation';

import { clearFirebaseSession, readSessionCookie } from '@/lib/firebase/session';
import { requestLogger } from '@/lib/http/request-id';
import { isSameOrigin } from '@/lib/http/same-origin';

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  if (!isSameOrigin(request)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 });
  const session = await readSessionCookie();
  await clearFirebaseSession();
  logger.info('signed out', { userId: session?.uid ?? null });
  redirect('/login');
}
