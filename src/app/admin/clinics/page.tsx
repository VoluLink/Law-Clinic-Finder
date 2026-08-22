import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { signInState, type AccessState } from '@/lib/admin/clinic-access';
import { AuthError, requireRole } from '@/lib/auth/require-role';
import { listAdminClinics, type AdminClinicRecord } from '@/lib/firebase/admin-clinic-store';

import { ClinicsManager, type AdminClinicRow, type PendingReview } from './ClinicsManager';

export const metadata: Metadata = { title: 'Law Clinics – Admin' };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('de-DE', { dateStyle: 'medium' });
}

function reviewKind(clinic: AdminClinicRecord): PendingReview['kind'] | null {
  if (clinic.approval_status === 'pending') return 'new';
  return clinic.profile?.accessStatus === 'pending' ? 'claim' : null;
}

function accessState(clinic: AdminClinicRecord): AccessState {
  if (!clinic.profile) return clinic.contact_email ? 'none' : 'no_email';
  return signInState(clinic.profile.lastSignInAt);
}

function pendingReview(clinic: AdminClinicRecord): PendingReview | null {
  const kind = reviewKind(clinic);
  if (!kind) return null;
  return {
    id: clinic.id,
    name: clinic.name,
    region: clinic.region,
    legal_areas: clinic.legal_areas,
    contact_email: clinic.contact_email,
    kind,
  };
}

function tableRow(clinic: AdminClinicRecord): AdminClinicRow {
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
    accessState: accessState(clinic),
    lastSignInLabel: clinic.profile?.lastSignInAt ? formatDate(clinic.profile.lastSignInAt) : null,
  };
}

export default async function AdminClinicsPage() {
  try {
    await requireRole(['admin']);
  } catch (error) {
    if (error instanceof AuthError) redirect('/login');
    throw error;
  }
  const clinics = await listAdminClinics();
  const pending = clinics.flatMap((clinic) => {
    const review = pendingReview(clinic);
    return review ? [review] : [];
  });
  const rows = clinics.filter((clinic) => clinic.approval_status === 'approved').map(tableRow);
  return <ClinicsManager clinics={rows} pending={pending} />;
}
