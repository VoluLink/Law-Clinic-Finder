import type { ReactNode } from 'react';

import { PortalShell, type NavItem } from '@/components/layout/PortalShell';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'gauge-high' },
  { href: '/admin/clinics', label: 'Law Clinics', icon: 'building-columns' },
  { href: '/admin/assistant', label: 'KI-Assistent', icon: 'robot' },
  { href: '/admin/logs', label: 'Protokolle', icon: 'file-lines' },
  { href: '/admin/branding', label: 'Branding', icon: 'palette' },
];

const TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/clinics': 'Law-Clinics-Datenbank',
  '/admin/assistant': 'KI-Assistent',
  '/admin/logs': 'Protokolle',
  '/admin/branding': 'Branding & Erscheinungsbild',
  '/admin/account': 'Konto & Zugang',
};

/** Admin console chrome — the teal sidebar shell with the admin nav + account. */
export function AdminChrome({ adminEmail, children }: { adminEmail: string; children: ReactNode }) {
  return (
    <PortalShell
      sectionLabel="Verwaltung"
      nav={NAV}
      homeHref="/admin"
      footer={{ href: '/admin/account', title: 'Admin', subtitle: adminEmail, navLabel: 'Konto' }}
      titles={TITLES}
      fallbackTitle="Admin"
    >
      {children}
    </PortalShell>
  );
}
