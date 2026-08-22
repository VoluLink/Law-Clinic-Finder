import type { Logger } from '@/lib/logger';

import type { AdminAccount } from './manage-admins';

export type OperationalAlertRecipient = {
  userId: string;
  email: string;
  source: 'default' | 'explicit';
};

export type OperationalAlertStore = {
  readSelectedUserId: () => Promise<string | null>;
  writeSelectedUserId: (userId: string) => Promise<boolean>;
};

type SelectionResult =
  | { status: 'ok'; recipient: OperationalAlertRecipient }
  | { status: 'invalid_admin' }
  | { status: 'error' };

function eligibleAdmins(admins: AdminAccount[]): AdminAccount[] {
  return admins.filter((admin) => admin.status === 'active');
}

function oldestAdmin(admins: AdminAccount[]): AdminAccount | null {
  return (
    [...eligibleAdmins(admins)].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0] ?? null
  );
}

function recipient(admin: AdminAccount, source: 'default' | 'explicit') {
  return { userId: admin.userId, email: admin.email, source };
}

export async function loadOperationalAlertRecipient(
  admins: AdminAccount[],
  store: OperationalAlertStore,
  logger: Logger,
): Promise<OperationalAlertRecipient | null> {
  try {
    const selectedUserId = await store.readSelectedUserId();
    const selected = eligibleAdmins(admins).find((admin) => admin.userId === selectedUserId);
    if (selected) return recipient(selected, 'explicit');
  } catch (error) {
    logger.warn('operational alert recipient load failed', { reason: errorName(error) });
  }
  const fallback = oldestAdmin(admins);
  return fallback ? recipient(fallback, 'default') : null;
}

export async function selectOperationalAlertRecipient(
  admins: AdminAccount[],
  store: OperationalAlertStore,
  userId: string,
  logger: Logger,
): Promise<SelectionResult> {
  const selected = eligibleAdmins(admins).find((admin) => admin.userId === userId);
  if (!selected) return { status: 'invalid_admin' };
  try {
    if (!(await store.writeSelectedUserId(userId))) return { status: 'invalid_admin' };
    logger.info('operational alert recipient selected');
    return { status: 'ok', recipient: recipient(selected, 'explicit') };
  } catch (error) {
    logger.error('operational alert recipient update failed', { reason: errorName(error) });
    return { status: 'error' };
  }
}

export async function reconcileOperationalAlertRecipient(
  admins: AdminAccount[],
  store: OperationalAlertStore,
  logger: Logger,
): Promise<void> {
  try {
    const selectedUserId = await store.readSelectedUserId();
    const selected = eligibleAdmins(admins).find((admin) => admin.userId === selectedUserId);
    if (selected) return;
    const fallback = oldestAdmin(admins);
    if (!fallback) return;
    if (!(await store.writeSelectedUserId(fallback.userId))) {
      logger.warn('operational alert fallback was no longer eligible');
      return;
    }
    logger.info('operational alert recipient defaulted');
  } catch (error) {
    logger.error('operational alert recipient reconciliation failed', { reason: errorName(error) });
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}
