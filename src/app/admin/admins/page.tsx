import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { listAdmins } from '@/lib/admin/manage-admins';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AdminsManager } from './AdminsManager';

export const metadata: Metadata = { title: 'Admin-Konten – Admin' };

export default async function AdminAccountsPage() {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const { data } = await supabase.auth.getClaims();
  const currentUserId = typeof data?.claims?.sub === 'string' ? data.claims.sub : '';
  const currentEmail = typeof data?.claims?.email === 'string' ? data.claims.email : '';
  const admins = await listAdmins({ adminClient: createSupabaseAdminClient(), logger });
  return (
    <AdminsManager admins={admins} currentEmail={currentEmail} currentUserId={currentUserId} />
  );
}
