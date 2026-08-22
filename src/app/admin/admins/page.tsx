import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { listAdmins } from '@/lib/admin/manage-admins';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { firebaseAdminAccountStore } from '@/lib/firebase/admin-account-store';
import { requestLogger } from '@/lib/http/request-id';

import { AdminsManager } from './AdminsManager';

export const metadata: Metadata = { title: 'Admin-Konten – Admin' };

export default async function AdminAccountsPage() {
  const logger = requestLogger({ headers: await headers() });
  let currentUserId = '';
  let currentEmail = '';
  try {
    const profile = await requireRole(['admin']);
    currentUserId = profile.user_id;
    currentEmail = profile.email ?? '';
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const admins = await listAdmins({ store: firebaseAdminAccountStore, logger });
  return <AdminsManager admins={admins} currentEmail={currentEmail} currentUserId={currentUserId} />;
}
