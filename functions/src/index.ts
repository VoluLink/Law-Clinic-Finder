import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

import { GoogleMonitoringClient } from './monitoring-client.js';
import { restoreDueClinics, type ClinicRestoreRow } from './restore-visibility.js';
import { syncOperationalAlerts } from './operational-alerts.js';
import { firebaseRecipientDependencies, resolveActiveAdminEmail } from './recipient.js';

const MONITORING_SERVICE_ACCOUNT =
  'law-clinic-monitoring@law-clinic-finder.iam.gserviceaccount.com';

export function rejectAccountCreation(): never {
  throw new HttpsError('permission-denied', 'Account creation is restricted.');
}

export const beforeAccountCreated = beforeUserCreated(
  {
    region: 'europe-west4',
    minInstances: 0,
    maxInstances: 3,
    memory: '256MiB',
    timeoutSeconds: 7,
  },
  rejectAccountCreation,
);

export const syncOperationalAlertConfiguration = onDocumentWritten(
  {
    document: 'settings/operations',
    database: 'primary-eu',
    region: 'europe-west4',
    serviceAccount: MONITORING_SERVICE_ACCOUNT,
    minInstances: 0,
    maxInstances: 1,
    concurrency: 1,
    memory: '256MiB',
    timeoutSeconds: 45,
    retry: true,
  },
  async (event) => {
    const setting = event.data?.after.exists ? event.data.after.data() : null;
    if (!setting) return;
    try {
      await syncOperationalAlerts(setting, {
        resolveAdminEmail: (userId) =>
          resolveActiveAdminEmail(userId, firebaseRecipientDependencies),
        monitoring: new GoogleMonitoringClient(),
      });
      logger.info('operational alert configuration synchronized');
    } catch (error) {
      logger.error('operational alert synchronization failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw error;
    }
  },
);

const APP_DATABASE = 'primary-eu';
const RESTORE_BATCH_LIMIT = 200;

function appFirestore() {
  if (getApps().length === 0) initializeApp();
  return getFirestore(APP_DATABASE);
}

/**
 * Daily sweep that ends temporary self-service pauses. Runs on a schedule rather
 * than lazily at read time so an entry reappears on the day the clinic chose,
 * whether or not anyone visits the site that day.
 */
export const restoreScheduledVisibility = onSchedule(
  {
    schedule: '15 3 * * *',
    timeZone: 'Europe/Berlin',
    region: 'europe-west4',
    minInstances: 0,
    maxInstances: 1,
    memory: '256MiB',
    timeoutSeconds: 120,
    retryCount: 1,
  },
  async () => {
    const database = appFirestore();
    const clinics = database.collection('clinics');
    const outcome = await restoreDueClinics({
      dueClinics: async (now): Promise<ClinicRestoreRow[]> => {
        const snapshot = await clinics
          .where('hiddenUntil', '<=', now)
          .limit(RESTORE_BATCH_LIMIT)
          .get();
        return snapshot.docs.map((document) => ({
          id: document.id,
          approvalStatus: String(document.get('approvalStatus') ?? ''),
        }));
      },
      republish: (ids) =>
        commit(database, ids, { isPublished: true, hiddenUntil: null, hiddenReason: null }),
      clearMark: (ids) => commit(database, ids, { hiddenUntil: null }),
    });
    // Ids are omitted deliberately: this log is not PII-free by accident.
    logger.info('scheduled visibility restore finished', outcome);
  },
);

async function commit(
  database: FirebaseFirestore.Firestore,
  ids: string[],
  patch: Record<string, unknown>,
): Promise<void> {
  const batch = database.batch();
  const updatedAt = new Date();
  for (const id of ids) {
    batch.update(database.collection('clinics').doc(id), { ...patch, updatedAt });
  }
  await batch.commit();
}
