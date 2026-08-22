import 'server-only';

import { listAdmins } from '@/lib/admin/manage-admins';
import { loadOperationalAlertRecipient } from '@/lib/admin/operational-alerts';
import { DEFAULT_BRANDING, loadBranding, type Branding } from '@/lib/branding/branding';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';
import { releaseClinicNotice } from '@/lib/firebase/clinic-notice-store';
import { readClinic, type ClinicView } from '@/lib/firebase/clinic-repository';
import { firebaseConfig } from '@/lib/firebase/env';
import { firebaseOperationalAlertStore } from '@/lib/firebase/operational-alert-store';
import type { Logger } from '@/lib/logger';

import { activeMailer } from './active-config';
import {
  renderClinicPublishedEmail,
  renderClinicSubmissionEmail,
} from './clinic-notification-email';

type NoticeMessage = { to: string; subject: string; text: string; html: string };

export type ClinicNoticeDependencies = {
  readClinic: (clinicId: string) => Promise<ClinicView | null>;
  release: (clinicId: string, field: 'submissionNotifiedAt' | 'publishNotifiedAt') => Promise<void>;
  branding: () => Promise<Branding>;
  send: (message: NoticeMessage) => Promise<void>;
  /** The single admin who receives all admin communication, or null if none. */
  adminRecipient: (logger: Logger) => Promise<string | null>;
  siteUrl: () => string;
};

async function brandingOrDefault(): Promise<Branding> {
  try {
    return await loadBranding(firebaseBrandingRepository);
  } catch {
    return DEFAULT_BRANDING;
  }
}

async function adminRecipient(logger: Logger): Promise<string | null> {
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  const recipient = await loadOperationalAlertRecipient(
    admins,
    firebaseOperationalAlertStore,
    logger,
  );
  return recipient?.email ?? null;
}

function defaultDependencies(): ClinicNoticeDependencies {
  return {
    readClinic,
    release: releaseClinicNotice,
    branding: brandingOrDefault,
    send: async (message) => (await activeMailer()).send(message),
    adminRecipient,
    siteUrl: () => firebaseConfig().siteUrl,
  };
}

/**
 * Delivers one claimed notice. Every failure path releases the mark again and
 * is reported without the clinic name, address, or message body, so a later
 * write can retry and the logs stay PII-free.
 */
async function deliver(
  clinicId: string,
  field: 'submissionNotifiedAt' | 'publishNotifiedAt',
  logger: Logger,
  deps: ClinicNoticeDependencies,
  build: (clinic: ClinicView, branding: Branding, siteUrl: string) => NoticeMessage | null,
): Promise<void> {
  try {
    const clinic = await deps.readClinic(clinicId);
    const message = clinic ? build(clinic, await deps.branding(), deps.siteUrl()) : null;
    if (!message) {
      logger.warn('clinic notice has no recipient', { clinicId, notice: field });
      await deps.release(clinicId, field);
      return;
    }
    await deps.send(message);
    logger.info('clinic notice sent', { clinicId, notice: field });
  } catch (error) {
    logger.error('clinic notice failed', {
      clinicId,
      notice: field,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    await deps.release(clinicId, field).catch(() => undefined);
  }
}

/** Tells the admin who receives admin communication that an entry awaits approval. */
export async function sendClinicSubmissionNotice(
  clinicId: string,
  logger: Logger,
  deps: ClinicNoticeDependencies = defaultDependencies(),
): Promise<void> {
  const recipient = await deps.adminRecipient(logger).catch(() => null);
  await deliver(clinicId, 'submissionNotifiedAt', logger, deps, (clinic, branding, siteUrl) => {
    if (!recipient) return null;
    const rendered = renderClinicSubmissionEmail({
      branding,
      siteUrl,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        contactEmail: clinic.contact_email,
        submittedAt: new Date(clinic.updated_at),
      },
    });
    return { to: recipient, ...rendered };
  });
}

/** Tells the clinic that its entry is now visible to the assistant. */
export async function sendClinicPublishedNotice(
  clinicId: string,
  logger: Logger,
  deps: ClinicNoticeDependencies = defaultDependencies(),
): Promise<void> {
  await deliver(clinicId, 'publishNotifiedAt', logger, deps, (clinic, branding, siteUrl) => {
    if (!clinic.contact_email) return null;
    const rendered = renderClinicPublishedEmail({
      branding,
      siteUrl,
      clinic: {
        name: clinic.name,
        contactEmail: clinic.contact_email,
        legalAreas: clinic.legal_areas,
      },
    });
    return { to: clinic.contact_email, ...rendered };
  });
}
