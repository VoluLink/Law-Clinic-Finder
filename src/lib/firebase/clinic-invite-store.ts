import { randomUUID } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import type { AccessStatus, ClinicInviteStore } from '@/lib/admin/invite-clinic';
import { sendSignInLink } from '@/lib/auth/email-link';
import { clinicInviteSchema } from '@/lib/clinics/schema';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { clinicNameReservationId } from './clinic-repository';
import { emailReservationReferences } from './identity-reservations';

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

async function createClinic(input: unknown): Promise<string> {
  const invite = clinicInviteSchema.parse(input);
  const database = firebaseFirestore();
  const clinicId = randomUUID();
  const clinicReference = database.collection('clinics').doc(clinicId);
  const nameReference = database
    .collection('uniqueClinicNames')
    .doc(clinicNameReservationId(invite.name));
  await database.runTransaction(async (transaction) => {
    if ((await transaction.get(nameReference)).exists) throw new Error('clinic name exists');
    const now = Timestamp.now();
    transaction.create(clinicReference, emptyClinic(invite.name, now));
    transaction.create(nameReference, { clinicId, name: invite.name, updatedAt: now });
    transaction.set(database.collection('clinicContacts').doc(clinicId), {
      contactEmail: invite.contact_email,
    });
  });
  return clinicId;
}

function emptyClinic(name: string, now: Timestamp) {
  return {
    name,
    description: null,
    region: null,
    website: null,
    legalAreas: '',
    targetClients: null,
    languages: null,
    requirements: null,
    advisesClients: true,
    isPublished: false,
    approvalStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  };
}

async function readInviteState(clinicIdInput: string) {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const database = firebaseFirestore();
  const [contact, profiles] = await Promise.all([
    database.collection('clinicContacts').doc(clinicId).get(),
    database.collection('profiles').where('clinicId', '==', clinicId).limit(2).get(),
  ]);
  const email = z.email().safeParse(contact.data()?.contactEmail);
  if (!email.success || profiles.size > 1) return null;
  return { email: email.data.toLowerCase(), userId: profiles.docs[0]?.id ?? null };
}

async function createIdentity(email: string): Promise<string | null> {
  try {
    return (await firebaseAdminAuth().createUser({ email, emailVerified: false })).uid;
  } catch (error) {
    if (errorCode(error) === 'auth/email-already-exists') return null;
    throw error;
  }
}

async function linkProfile(
  userId: string,
  clinicId: string,
  email: string,
  accessStatus: AccessStatus,
): Promise<void> {
  const database = firebaseFirestore();
  const emailReferences = emailReservationReferences(database, email);
  const ownerReference = database.collection('uniqueClinicOwners').doc(clinicId);
  const contactReference = database.collection('clinicContacts').doc(clinicId);
  await database.runTransaction(async (transaction) => {
    const [emailOwner, pendingEmailOwner, clinicOwner] = await Promise.all([
      transaction.get(emailReferences.active),
      transaction.get(emailReferences.pending),
      transaction.get(ownerReference),
    ]);
    if (emailOwner.exists || pendingEmailOwner.exists || clinicOwner.exists) {
      throw new Error('identity is already reserved');
    }
    const now = Timestamp.now();
    transaction.create(emailReferences.active, { userId, role: 'clinic', updatedAt: now });
    transaction.create(ownerReference, { userId, updatedAt: now });
    transaction.create(database.collection('profiles').doc(userId), {
      role: 'clinic',
      clinicId,
      accessStatus,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(contactReference, { contactEmail: email });
  });
}

async function createAndLinkUser(
  clinicIdInput: string,
  emailInput: string,
  accessStatus: AccessStatus,
) {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const email = z.string().trim().email().parse(emailInput).toLowerCase();
  const userId = await createIdentity(email);
  if (!userId) return 'already_invited' as const;
  try {
    await firebaseAdminAuth().setCustomUserClaims(userId, {
      role: 'clinic',
      clinicId,
      accessStatus,
    });
    await linkProfile(userId, clinicId, email, accessStatus);
  } catch (error) {
    await firebaseAdminAuth().deleteUser(userId);
    throw error;
  }
  try {
    await sendSignInLink({ email, userId, purpose: 'invite' });
    return 'ok' as const;
  } catch {
    return 'invite_failed' as const;
  }
}

async function resendInvite(clinicId: string, userId: string, email: string) {
  const user = await firebaseAdminAuth().getUser(userId);
  if (user.metadata.lastSignInTime) return 'already_invited' as const;
  if (user.email?.toLowerCase() !== email.toLowerCase()) throw new Error('invite email mismatch');
  try {
    await sendSignInLink({ email, userId, purpose: 'invite' });
    return 'ok' as const;
  } catch {
    return 'invite_failed' as const;
  }
}

export const firebaseClinicInviteStore: ClinicInviteStore = {
  createClinic,
  readInviteState,
  createAndLinkUser,
  resendInvite,
};
