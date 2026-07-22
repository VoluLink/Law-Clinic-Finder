import { redirect } from 'next/navigation';

import { AdminChrome } from '@/components/admin/AdminChrome';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const { data } = await supabase.auth.getClaims();
  const adminEmail = typeof data?.claims?.email === 'string' ? data.claims.email : '';
  return <AdminChrome adminEmail={adminEmail}>{children}</AdminChrome>;
}
