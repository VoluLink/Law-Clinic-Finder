import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { listAdmins } from '@/lib/admin/manage-admins';
import { loadOperationalAlertRecipient } from '@/lib/admin/operational-alerts';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { firebaseOperationalAlertStore } from '@/lib/firebase/operational-alert-store';
import { firebaseSmtpSettingsStore } from '@/lib/firebase/smtp-settings-store';
import { requestLogger } from '@/lib/http/request-id';
import { hasEnvironmentSmtpConfig } from '@/lib/mail/active-config';
import { smtpSettingsView, type SmtpSettingsView } from '@/lib/mail/smtp-settings';

import { OperationalAlertsPanel } from './OperationalAlertsPanel';
import { SmtpForm } from './SmtpForm';

export const metadata: Metadata = { title: 'Benachrichtigungen – Admin' };

/** A Secret Manager outage must not blank the admin console: the screen renders
 *  read-only with an explicit notice instead. */
async function loadView(): Promise<SmtpSettingsView> {
  const environmentFallback = hasEnvironmentSmtpConfig();
  try {
    const state = await firebaseSmtpSettingsStore.load();
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
  } catch (error) {
    requestLogger().warn('smtp configuration unavailable', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return smtpSettingsView(null, {
      environmentFallback,
      rollbackAvailable: false,
      provisioned: false,
    });
  }
}

/** Who receives admin mail, and how mail is sent — one screen, because both
 *  questions are asked together whenever notifications are set up. */
async function loadRecipient() {
  const logger = requestLogger({ headers: await headers() });
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  const recipient = await loadOperationalAlertRecipient(
    admins,
    firebaseOperationalAlertStore,
    logger,
  );
  return { admins, recipient };
}

export default async function AdminNotificationsPage() {
  const [view, alerts] = await Promise.all([loadView(), loadRecipient()]);
  return (
    <div className="flex flex-col gap-6">
      <OperationalAlertsPanel admins={alerts.admins} recipient={alerts.recipient} />
      <SmtpForm view={view} />
    </div>
  );
}
