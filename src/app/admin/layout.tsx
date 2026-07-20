import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AreaHeader } from '@/components/layout/AreaHeader';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const NAV_LINKS = [
  { href: '/admin', label: 'Übersicht' },
  { href: '/admin/clinics', label: 'Law Clinics' },
  { href: '/admin/conversations', label: 'Konversationen' },
  { href: '/admin/settings', label: 'Einstellungen' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  return (
    <div className="flex flex-1 flex-col bg-background">
      <AreaHeader title="Admin" />
      <nav className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl gap-6 px-6 py-2 text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
