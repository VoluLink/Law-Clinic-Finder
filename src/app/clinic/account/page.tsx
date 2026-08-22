import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthError, requireRole, type Profile } from '@/lib/auth/require-role';

import { AccountDeletePanel } from './AccountDeletePanel';

export const metadata: Metadata = { title: 'Konto – Law Clinic Finder' };

export default async function ClinicAccountPage() {
  let profile: Profile & { email?: string };
  try {
    profile = await requireRole(['clinic', 'admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  if (!profile.clinic_id) return <AdminHint />;
  const email = profile.email ?? '';
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section>
        <div className="text-[13px] font-bold tracking-[0.14em] text-muted-soft uppercase">
          Konto
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">Dein Zugang</h1>
        {email && <p className="mt-2 text-base text-muted">Angemeldet als {email}.</p>}
      </section>
      <AccountDeletePanel />
    </div>
  );
}

function AdminHint() {
  return (
    <p className="text-sm text-muted">
      Dieses Konto ist keiner Law Clinic zugeordnet. Zur Verwaltung nutze den{' '}
      <Link href="/admin" className="text-primary underline">
        Admin-Bereich
      </Link>
      .
    </p>
  );
}
