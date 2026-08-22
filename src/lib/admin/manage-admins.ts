import type { Logger } from '@/lib/logger';

export type AdminAccount = {
  userId: string;
  email: string;
  status: 'active' | 'invited';
  createdAt: string;
};

export type AdminInviteResult =
  { status: 'ok' } | { status: 'email_taken' } | { status: 'invite_failed' } | { status: 'error' };

export type AdminRemovalResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'self' }
  | { status: 'last_admin' }
  | { status: 'error' };

export type AdminAccountStore = {
  list: () => Promise<AdminAccount[]>;
  invite: (email: string) => Promise<AdminInviteResult>;
  remove: (userId: string, actingUserId: string) => Promise<AdminRemovalResult>;
};

export type AdminAccountDeps = { store: AdminAccountStore; logger: Logger };

export async function listAdmins(deps: AdminAccountDeps): Promise<AdminAccount[]> {
  try {
    return await deps.store.list();
  } catch (error) {
    deps.logger.warn('admin list failed', { reason: errorMessage(error) });
    return [];
  }
}

export async function inviteAdmin(
  deps: AdminAccountDeps,
  email: string,
): Promise<AdminInviteResult> {
  try {
    const result = await deps.store.invite(email);
    if (result.status === 'ok') deps.logger.info('admin invited');
    return result;
  } catch (error) {
    deps.logger.error('admin invite failed', { reason: errorMessage(error) });
    return { status: 'error' };
  }
}

export async function removeAdmin(
  deps: AdminAccountDeps,
  userId: string,
  actingUserId: string,
): Promise<AdminRemovalResult> {
  try {
    const result = await deps.store.remove(userId, actingUserId);
    if (result.status === 'ok') deps.logger.info('admin removed');
    return result;
  } catch (error) {
    deps.logger.error('admin removal failed', { reason: errorMessage(error) });
    return { status: 'error' };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
