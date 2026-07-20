import type { Metadata } from 'next';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ClinicsManager, type AdminClinic } from './ClinicsManager';
import { PendingSubmissions, type PendingSubmission } from './PendingSubmissions';

export const metadata: Metadata = { title: 'Law Clinics – Admin' };

const ADMIN_COLUMNS =
  'id, name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements, is_published';

const SUBMISSION_COLUMNS = 'id, name, region, legal_areas, contact_email, submitted_at';

// clinic_submissions has no RLS policies (service client only); the admin
// layout already re-checked the role, so reading them here stays admin-gated.
async function loadSubmissions(): Promise<PendingSubmission[]> {
  if (!process.env.SUPABASE_SECRET_KEY) return [];
  const { data } = await createSupabaseAdminClient()
    .from('clinic_submissions')
    .select(SUBMISSION_COLUMNS)
    .order('submitted_at', { ascending: true });
  return (data ?? []) as unknown as PendingSubmission[];
}

export default async function AdminClinicsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data }, submissions] = await Promise.all([
    supabase.from('clinics').select(ADMIN_COLUMNS).order('name'),
    loadSubmissions(),
  ]);
  // Untyped supabase client cannot infer rows from the column string; the
  // selected columns match AdminClinic exactly.
  return (
    <>
      <PendingSubmissions submissions={submissions} />
      <ClinicsManager clinics={(data ?? []) as unknown as AdminClinic[]} />
    </>
  );
}
