import type { Metadata } from 'next';

import { firebaseSmtpSettingsStore } from '@/lib/firebase/smtp-settings-store';
import { requestLogger } from '@/lib/http/request-id';
import { hasEnvironmentSmtpConfig } from '@/lib/mail/active-config';
import { smtpSettingsView, type SmtpSettingsView } from '@/lib/mail/smtp-settings';

import { SmtpForm } from './SmtpForm';

export const metadata: Metadata = { title: 'E-Mail-Versand – Admin' };

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

export default async function AdminSmtpPage() {
  return <SmtpForm view={await loadView()} />;
}
