import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { deriveAccessState, loadLastSignInMap, profileUserId } from '@/lib/admin/clinic-access';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ClinicsManager, type AdminClinicRow, type PendingSubmission } from './ClinicsManager';

export const metadata: Metadata = { title: 'Law Clinics – Admin' };

const ADMIN_COLUMNS =
  'id, name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements, advises_clients, is_published, profiles(user_id)';

const SUBMISSION_COLUMNS = 'id, name, region, legal_areas, contact_email, submitted_at';

type ClinicQueryRow = Omit<AdminClinicRow, 'accessState' | 'lastSignInLabel'> & {
  profiles: { user_id: string }[] | { user_id: string } | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' });
}

export default async function AdminClinicsPage() {
  const supabase = await createSupabaseServerClient();
  try {
    await requireRole(supabase, ['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const admin = createSupabaseAdminClient();
  const [{ data }, lastSignIn, submissions] = await Promise.all([
    admin.from('clinics').select(ADMIN_COLUMNS).order('name'),
    loadLastSignInMap(admin).catch(() => new Map<string, string | null>()),
    loadSubmissions(admin),
  ]);

  const rows = ((data ?? []) as unknown as ClinicQueryRow[]).map((clinic) =>
    enrich(clinic, lastSignIn),
  );
  return <ClinicsManager clinics={rows} pending={submissions} />;
}

function enrich(clinic: ClinicQueryRow, signInMap: Map<string, string | null>): AdminClinicRow {
  const { profiles, ...fields } = clinic;
  const userId = profileUserId(profiles);
  const lastSignIn = userId ? signInMap.get(userId) : null;
  return {
    ...fields,
    accessState: deriveAccessState({ contact_email: fields.contact_email, profiles }, signInMap),
    lastSignInLabel: lastSignIn ? formatDate(lastSignIn) : null,
  };
}

// clinic_submissions has no RLS policies (service client only); this page
// re-checks the admin role before loading them.
async function loadSubmissions(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<PendingSubmission[]> {
  const { data } = await admin
    .from('clinic_submissions')
    .select(SUBMISSION_COLUMNS)
    .order('submitted_at', { ascending: true });
  return (data ?? []) as unknown as PendingSubmission[];
}
