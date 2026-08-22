import type { Profile } from '@/lib/auth/require-role';

import { firebaseFirestore } from './admin';
import { profileDocumentSchema, type ProfileDocument } from './documents';

export async function readProfileDocument(userId: string): Promise<ProfileDocument | null> {
  const snapshot = await firebaseFirestore().collection('profiles').doc(userId).get();
  return snapshot.exists ? profileDocumentSchema.parse(snapshot.data()) : null;
}

export async function readProfile(userId: string): Promise<Profile | null> {
  const profile = await readProfileDocument(userId);
  if (!profile) return null;
  return {
    role: profile.role,
    clinic_id: profile.clinicId,
    access_status: profile.accessStatus,
    activated_at: profile.activatedAt?.toISOString() ?? null,
  };
}
