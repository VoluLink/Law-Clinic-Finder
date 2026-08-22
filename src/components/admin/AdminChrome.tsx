import type { ReactNode } from 'react';

import { PortalShell, type NavItem } from '@/components/layout/PortalShell';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'gauge-high' },
  { href: '/admin/clinics', label: 'Law Clinics', icon: 'building-columns' },
  { href: '/admin/assistant', label: 'KI-Assistent', icon: 'robot' },
  { href: '/admin/logs', label: 'Protokolle', icon: 'file-lines' },
  { href: '/admin/branding', label: 'Branding', icon: 'palette' },
  { href: '/admin/smtp', label: 'Benachrichtigungen', icon: 'envelope' },
  { href: '/admin/admins', label: 'Admins', icon: 'users' },
];

const TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/clinics': 'Law-Clinics-Datenbank',
  '/admin/admins': 'Admin-Konten',
  '/admin/assistant': 'KI-Assistent',
  '/admin/logs': 'Protokolle',
  '/admin/branding': 'Branding & Erscheinungsbild',
  '/admin/smtp': 'Benachrichtigungen',
};

/** Admin console chrome — the teal sidebar shell with admin navigation and identity. */
export function AdminChrome({ adminEmail, children }: { adminEmail: string; children: ReactNode }) {
  return (
    <PortalShell
      sectionLabel="Verwaltung"
      nav={NAV}
      homeHref="/admin"
      footer={{ title: 'Admin', subtitle: adminEmail }}
      titles={TITLES}
      fallbackTitle="Admin"
    >
      {children}
    </PortalShell>
  );
}
