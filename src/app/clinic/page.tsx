import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AreaHeader } from '@/components/layout/AreaHeader';
import { Card } from '@/components/ui/Card';
import { AuthError, requireRole, type Profile } from '@/lib/auth/require-role';
import { clinicEditableSchema } from '@/lib/clinics/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ClinicForm } from './ClinicForm';

export const metadata: Metadata = { title: 'Mein Eintrag – Law Clinic Finder' };

const EDITABLE_COLUMNS =
  'name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements';

export default async function ClinicPage() {
  const supabase = await createSupabaseServerClient();
  let profile: Profile;
  try {
    profile = await requireRole(supabase, ['clinic', 'admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  return (
    <div className="flex flex-1 flex-col bg-background">
      <AreaHeader title="Mein Eintrag" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        {profile.clinic_id ? <ClinicEditor clinicId={profile.clinic_id} /> : <AdminHint />}
      </main>
    </div>
  );
}

async function ClinicEditor({ clinicId }: { clinicId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('clinics')
    .select(EDITABLE_COLUMNS)
    .eq('id', clinicId)
    .maybeSingle();
  if (!data) {
    return <p className="text-sm text-danger">Ihr Eintrag wurde nicht gefunden.</p>;
  }
  return (
    <Card className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-foreground">Eintrag Ihrer Law Clinic</h1>
      <ClinicForm clinic={clinicEditableSchema.parse(data)} />
    </Card>
  );
}

function AdminHint() {
  return (
    <p className="text-sm text-muted">
      Ihr Konto ist keiner Law Clinic zugeordnet. Zur Verwaltung nutzen Sie den{' '}
      <Link href="/admin" className="text-primary underline">
        Admin-Bereich
      </Link>
      .
    </p>
  );
}
