import { redirect } from 'next/navigation';

import { PortalShell, type NavItem } from '@/components/layout/PortalShell';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NAV: NavItem[] = [
  { href: '/clinic', label: 'Mein Eintrag', icon: 'address-card' },
  { href: '/clinic/statistics', label: 'Statistiken', icon: 'chart-column' },
];

const TITLES: Record<string, string> = {
  '/clinic': 'Mein Eintrag',
  '/clinic/statistics': 'Statistiken',
  '/clinic/account': 'Konto',
  '/clinic/pending': 'Freigabe ausstehend',
};

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  let clinicName = '';
  let pending = false;
  try {
    const profile = await requireRole(supabase, ['clinic', 'admin']);
    pending = profile.access_status === 'pending';
    if (profile.clinic_id) {
      const { data } = await supabase
        .from('clinics')
        .select('name')
        .eq('id', profile.clinic_id)
        .maybeSingle();
      clinicName = data?.name ?? '';
    }
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : '';
  // A pending claimant may only reach the waiting page, so offering the other
  // tabs would just bounce them off the proxy.
  return (
    <PortalShell
      sectionLabel="Mitgliederbereich"
      nav={pending ? [] : NAV}
      homeHref="/clinic"
      footer={{
        href: pending ? '/clinic/pending' : '/clinic/account',
        title: clinicName || 'Konto',
        subtitle: email,
        navLabel: pending ? 'Freigabe' : 'Konto',
      }}
      titles={TITLES}
      fallbackTitle="Mitgliederbereich"
    >
      {children}
    </PortalShell>
  );
}
