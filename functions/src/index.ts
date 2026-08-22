import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { GoogleMonitoringClient } from './monitoring-client.js';
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
