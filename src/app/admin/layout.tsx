import { redirect } from 'next/navigation';

import { AdminChrome } from '@/components/admin/AdminChrome';
import { AuthError, requireRole } from '@/lib/auth/require-role';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let adminEmail = '';
  try {
    adminEmail = (await requireRole(['admin'])).email ?? '';
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  return <AdminChrome adminEmail={adminEmail}>{children}</AdminChrome>;
}
