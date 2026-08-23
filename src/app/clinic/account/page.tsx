import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthError, requireRole, type Profile } from '@/lib/auth/require-role';
import { currentVisibility } from '@/lib/clinics/visibility';
import { getClinic } from '@/lib/clinics/server';

import { AccountDeletePanel } from './AccountDeletePanel';
import { VisibilityPanel } from './VisibilityPanel';

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
  const clinic = await getClinic(profile.clinic_id);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section>
        <div className="text-[13px] font-bold tracking-[0.14em] text-muted-soft uppercase">
          Konto
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">Dein Zugang</h1>
        {email && <p className="mt-2 text-base text-muted">Angemeldet als {email}.</p>}
      </section>
      {clinic && (
        <VisibilityPanel
          state={currentVisibility({
            isPublished: clinic.is_published,
            hiddenReason: clinic.hidden_reason,
          })}
          hiddenUntilLabel={formatReturnDay(clinic.hidden_until)}
        />
      )}
      <AccountDeletePanel />
    </div>
  );
}

function formatReturnDay(hiddenUntil: string | null): string | null {
  if (!hiddenUntil) return null;
  return new Date(hiddenUntil).toLocaleDateString('de-DE', { dateStyle: 'long' });
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
