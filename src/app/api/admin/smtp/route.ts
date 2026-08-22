import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { runSmtpChange } from '@/lib/admin/smtp-change-runner';
import { activateSmtpSettings } from '@/lib/admin/smtp-configuration';
import { firebaseSmtpSettingsStore } from '@/lib/firebase/smtp-settings-store';
import { requestLogger } from '@/lib/http/request-id';
import { hasEnvironmentSmtpConfig } from '@/lib/mail/active-config';
import { smtpSettingsUpdateSchema, smtpSettingsView } from '@/lib/mail/smtp-settings';
import type { SmtpSecretState } from '@/lib/mail/settings-store';

function view(state: SmtpSecretState) {
  const environmentFallback = hasEnvironmentSmtpConfig();
  if (state.status !== 'active') {
    return smtpSettingsView(null, {
      environmentFallback,
      rollbackAvailable: false,
      provisioned: state.status === 'empty',
    });
  }
  return smtpSettingsView(state.stored, {
    environmentFallback,
    rollbackAvailable: state.previous !== null,
    provisioned: true,
  });
}

export async function GET(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  try {
    return Response.json(view(await firebaseSmtpSettingsStore.load()));
  } catch (error) {
    logger.error('smtp configuration read failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return Response.json({ error: 'Laden fehlgeschlagen.' }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const parsed = smtpSettingsUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Ungültige Eingaben.' }, { status: 400 });
  return runSmtpChange(request, guard, logger, (dependencies, actorId) =>
    activateSmtpSettings(dependencies, { update: parsed.data, actorId }),
  );
}
