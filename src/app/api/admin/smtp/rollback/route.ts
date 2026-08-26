import { requirePrivilegedAdminRoute } from '@/lib/auth/admin-guard';
import { runSmtpChange } from '@/lib/admin/smtp-change-runner';
import { rollbackSmtpSettings } from '@/lib/admin/smtp-configuration';
import { requestLogger } from '@/lib/http/request-id';

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requirePrivilegedAdminRoute(request);
  if ('response' in guard) return guard.response;
  return runSmtpChange(request, guard, logger, (dependencies, actorId) =>
    rollbackSmtpSettings(dependencies, { actorId }),
  );
}
