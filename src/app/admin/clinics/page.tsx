import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { deriveAccessState, loadLastSignInMap, profileUserId } from '@/lib/admin/clinic-access';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { ClinicsManager, type AdminClinicRow, type PendingReview } from './ClinicsManager';

export const metadata: Metadata = { title: 'Law Clinics – Admin' };

const ADMIN_COLUMNS =
  'id, name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements, advises_clients, is_published, approval_status, ' +
  'profiles(user_id, access_status)';

type ProfileLink = { user_id: string; access_status: string };

type ClinicQueryRow = Omit<AdminClinicRow, 'accessState' | 'lastSignInLabel'> & {
  approval_status: string;
  profiles: ProfileLink[] | ProfileLink | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'medium' });
}

function firstProfile(profiles: ClinicQueryRow['profiles']): ProfileLink | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

/**
 * Two different things land in the review queue: an entry that does not exist in
 * the directory yet, and a claim on an entry an admin created. They read the
 * same but reject differently, so the queue names which is which.
 */
function reviewKind(clinic: ClinicQueryRow): PendingReview['kind'] | null {
  if (clinic.approval_status === 'pending') return 'new';
  return firstProfile(clinic.profiles)?.access_status === 'pending' ? 'claim' : null;
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
  const [{ data }, lastSignIn] = await Promise.all([
    admin.from('clinics').select(ADMIN_COLUMNS).order('name'),
    loadLastSignInMap(admin).catch(() => new Map<string, string | null>()),
  ]);

  const clinics = (data ?? []) as unknown as ClinicQueryRow[];
  const pending = clinics
    .map((clinic) => ({ clinic, kind: reviewKind(clinic) }))
    .filter((entry): entry is { clinic: ClinicQueryRow; kind: PendingReview['kind'] } =>
      Boolean(entry.kind),
    )
    .map(({ clinic, kind }) => ({
      id: clinic.id,
      name: clinic.name,
      region: clinic.region,
      legal_areas: clinic.legal_areas,
      contact_email: clinic.contact_email,
      kind,
    }));

  // An unapproved entry is not part of the directory yet, so it belongs in the
  // review queue rather than the table of live entries.
  const rows = clinics
    .filter((clinic) => clinic.approval_status === 'approved')
    .map((clinic) => enrich(clinic, lastSignIn));
  return <ClinicsManager clinics={rows} pending={pending} />;
}

/** Builds the table row field by field, so neither the review flag nor the
 *  embedded profile link crosses into the client component. */
function enrich(clinic: ClinicQueryRow, signInMap: Map<string, string | null>): AdminClinicRow {
  const userId = profileUserId(clinic.profiles);
  const lastSignIn = userId ? signInMap.get(userId) : null;
  return {
    id: clinic.id,
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    contact_email: clinic.contact_email,
    website: clinic.website,
    legal_areas: clinic.legal_areas,
    target_clients: clinic.target_clients,
    languages: clinic.languages,
    requirements: clinic.requirements,
    advises_clients: clinic.advises_clients,
    is_published: clinic.is_published,
    accessState: deriveAccessState(clinic, signInMap),
    lastSignInLabel: lastSignIn ? formatDate(lastSignIn) : null,
  };
}
