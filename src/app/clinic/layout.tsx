import { redirect } from 'next/navigation';

import { PortalShell, type NavItem } from '@/components/layout/PortalShell';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NAV: NavItem[] = [
  { href: '/clinic', label: 'Mein Eintrag', icon: '▤' },
  { href: '/clinic/statistics', label: 'Statistiken', icon: '▧' },
];

const TITLES: Record<string, string> = {
  '/clinic': 'Mein Eintrag',
  '/clinic/statistics': 'Statistiken',
  '/clinic/account': 'Konto',
};

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  let clinicName = '';
  try {
    const profile = await requireRole(supabase, ['clinic', 'admin']);
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
  return (
    <PortalShell
      sectionLabel="Mitgliederbereich"
      nav={NAV}
      homeHref="/clinic"
      footer={{
        href: '/clinic/account',
        title: clinicName || 'Konto',
        subtitle: email,
        navLabel: 'Konto',
      }}
      titles={TITLES}
      fallbackTitle="Mitgliederbereich"
    >
      {children}
    </PortalShell>
  );
}
