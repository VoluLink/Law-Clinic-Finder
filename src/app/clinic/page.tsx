import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/Card';
import { AuthError, requireRole, type Profile } from '@/lib/auth/require-role';
import { getClinic } from '@/lib/clinics/server';
import { clinicEditableSchema } from '@/lib/clinics/schema';

import { ClinicForm } from './ClinicForm';

export const metadata: Metadata = { title: 'Mein Eintrag – Law Clinic Finder' };

export default async function ClinicPage() {
  let profile: Profile;
  try {
    profile = await requireRole(['clinic', 'admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  return (
    <div className="mx-auto w-full max-w-2xl">
      {profile.clinic_id ? <ClinicEditor clinicId={profile.clinic_id} /> : <AdminHint />}
    </div>
  );
}

async function ClinicEditor({ clinicId }: { clinicId: string }) {
  const clinic = await getClinic(clinicId);
  if (!clinic) {
    return <p className="text-sm text-danger">Ihr Eintrag wurde nicht gefunden.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[13px] font-bold tracking-[0.14em] text-muted-soft uppercase">
          Mitgliederbereich
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">
          Dein Law-Clinic-Eintrag
        </h1>
        <p className="mt-2 max-w-xl text-base text-muted">
          Das sehen ratsuchende Menschen, wenn der Finder deine Law Clinic vorschlägt. Halte die
          Angaben aktuell, damit dich die richtigen Anfragen erreichen.
        </p>
      </div>
      <Card variant="panel" className="p-6 sm:p-6">
        <ClinicForm clinic={clinicEditableSchema.parse(clinic)} />
      </Card>
    </div>
  );
}

function AdminHint() {
  return (
    <p className="text-sm text-muted">
      Dein Konto ist keiner Law Clinic zugeordnet. Zur Verwaltung nutze den{' '}
      <Link href="/admin" className="text-primary underline">
        Admin-Bereich
      </Link>
      .
    </p>
  );
}
