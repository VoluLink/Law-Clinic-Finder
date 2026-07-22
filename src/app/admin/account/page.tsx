import type { Metadata } from 'next';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AccountForm } from './AccountForm';

export const metadata: Metadata = { title: 'Konto & Zugang – Admin' };

export default async function AdminAccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : '';
  return <AccountForm currentEmail={email} />;
}
