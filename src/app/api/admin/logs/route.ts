import { requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { firebaseLogRepository } from '@/lib/firebase/log-repository';
import { requestLogger } from '@/lib/http/request-id';

export async function DELETE(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  try {
    await firebaseLogRepository.clear();
  } catch (error) {
    logger.error('logs clear failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
