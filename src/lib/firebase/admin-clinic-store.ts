import type { UserRecord } from 'firebase-admin/auth';
import { z } from 'zod';

import { prepareAdminClinicUpdate, type StoredAdminClinic } from '@/lib/admin/admin-clinic-update';
import { signInState } from '@/lib/admin/clinic-access';
import { owesPublicationNotice } from '@/lib/clinics/notification-state';
import { clinicAdminSchema, type ClinicAdmin } from '@/lib/clinics/schema';

import { firebaseAdminAuth, firebaseFirestore } from './admin';
import { invalidateClinicDirectory } from './clinic-directory';
import {
  clinicNameReservationId,
  clinicUpdateDocument,
  readClinic,
  reserveClinicName,
  type ClinicView,
} from './clinic-repository';
import {
  clinicContactDocumentSchema,
  clinicDocumentSchema,
  profileDocumentSchema,
} from './documents';
import { firebaseClinicAccessStore } from './revoke-clinic-access';
import { invalidateSignupDirectory } from './signup-directory';

export type AdminClinicProfile = {
  userId: string;
  accessStatus: 'pending' | 'active';
  lastSignInAt: string | null;
};

export type AdminClinicRecord = ClinicView & { profile: AdminClinicProfile | null };

export type AdminClinicUpdateResult =
  /** `notifyPublication` claims the once-ever notice owed to the clinic. */
  | { status: 'ok'; notifyPublication: boolean }
  | { status: 'not_found' }
  | { status: 'incomplete'; missing: string[] }
  | { status: 'unapproved' };

async function loadAllAuthUsers(): Promise<Map<string, UserRecord>> {
  const users = new Map<string, UserRecord>();
  let pageToken: string | undefined;
  do {
    const page = await firebaseAdminAuth().listUsers(1_000, pageToken);
    for (const user of page.users) users.set(user.uid, user);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function loadClinicProfiles(authUsers: Map<string, UserRecord>) {
  const snapshot = await firebaseFirestore()
    .collection('profiles')
    .where('role', '==', 'clinic')
    .get();
  const profiles = new Map<string, AdminClinicProfile>();
  for (const document of snapshot.docs) {
    const profile = profileDocumentSchema.parse(document.data());
    if (!profile.clinicId) continue;
    if (profiles.has(profile.clinicId)) throw new Error('multiple profiles reference one clinic');
    const lastSignInAt = authUsers.get(document.id)?.metadata.lastSignInTime ?? null;
    profiles.set(profile.clinicId, {
      userId: document.id,
      accessStatus: profile.accessStatus,
      lastSignInAt,
    });
  }
  return profiles;
}

export type ClinicDashboardCounts = {
  total: number;
  published: number;
  accessActive: number;
  accessInvited: number;
};

/*
 * The dashboard only needs five numbers, but `listAdminClinics()` reads every
 * clinic document plus every clinicContacts document to produce them — 118 reads
 * on a 59-clinic directory, on every render, for counts. Aggregation queries bill
 * a single read each, and the access split comes from the clinic profiles, which
 * is a far smaller collection than the directory.
 */
export async function loadClinicDashboardCounts(): Promise<ClinicDashboardCounts> {
  const clinics = firebaseFirestore().collection('clinics');
  const [total, published, profiles] = await Promise.all([
    clinics.count().get(),
    clinics.where('isPublished', '==', true).count().get(),
    loadClinicProfiles(await loadAllAuthUsers()),
  ]);
  const states = [...profiles.values()].map((profile) => signInState(profile.lastSignInAt));
  return {
    total: total.data().count,
    published: published.data().count,
    accessActive: states.filter((state) => state === 'active').length,
    accessInvited: states.filter((state) => state === 'invited').length,
  };
}

export async function listAdminClinics(): Promise<AdminClinicRecord[]> {
  const database = firebaseFirestore();
  const [clinics, authUsers] = await Promise.all([
    database.collection('clinics').orderBy('name').get(),
    loadAllAuthUsers(),
  ]);
  if (clinics.empty) return [];
  const [contacts, profiles] = await Promise.all([
    database.getAll(...clinics.docs.map((clinic) => database.doc(`clinicContacts/${clinic.id}`))),
    loadClinicProfiles(authUsers),
  ]);
  return clinics.docs.map((document, index) =>
    adminClinicRecord(document.id, document.data(), contacts[index].data(), profiles),
  );
}

function adminClinicRecord(
  id: string,
  clinicData: unknown,
  contactData: unknown,
  profiles: Map<string, AdminClinicProfile>,
): AdminClinicRecord {
  const clinic = clinicDocumentSchema.parse(clinicData);
  const contact = contactData ? clinicContactDocumentSchema.parse(contactData).contactEmail : null;
  return {
    id,
    ...legacyClinicFields(clinic, contact),
    is_published: clinic.isPublished,
    approval_status: clinic.approvalStatus,
    created_at: clinic.createdAt.toISOString(),
    updated_at: clinic.updatedAt.toISOString(),
    profile: profiles.get(id) ?? null,
  };
}

function legacyClinicFields(
  clinic: z.infer<typeof clinicDocumentSchema>,
  contactEmail: string | null,
) {
  return {
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    contact_email: contactEmail,
    website: clinic.website,
    legal_areas: clinic.legalAreas,
    target_clients: clinic.targetClients,
    languages: clinic.languages,
    requirements: clinic.requirements,
    advises_clients: clinic.advisesClients,
  };
}

export async function updateAdminClinic(
  clinicIdInput: string,
  input: Partial<ClinicAdmin>,
): Promise<AdminClinicUpdateResult> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const incoming = clinicAdminSchema.partial().parse(input);
  const database = firebaseFirestore();
  const result = await database.runTransaction((transaction) =>
    updateClinicTransaction(transaction, clinicId, incoming),
  );
  if (result.status === 'ok') invalidateClinicCaches();
  return result;
}

async function updateClinicTransaction(
  transaction: FirebaseFirestore.Transaction,
  clinicId: string,
  incoming: Partial<ClinicAdmin>,
): Promise<AdminClinicUpdateResult> {
  const database = firebaseFirestore();
  const clinicReference = database.doc(`clinics/${clinicId}`);
  const contactReference = database.doc(`clinicContacts/${clinicId}`);
  const [clinicSnapshot, contactSnapshot] = await Promise.all([
    transaction.get(clinicReference),
    transaction.get(contactReference),
  ]);
  if (!clinicSnapshot.exists) return { status: 'not_found' };
  const clinic = clinicDocumentSchema.parse(clinicSnapshot.data());
  const contact = contactSnapshot.exists
    ? clinicContactDocumentSchema.parse(contactSnapshot.data()).contactEmail
    : null;
  const prepared = prepareAdminClinicUpdate(storedClinic(clinic, contact), incoming);
  if (!prepared.allowed) return preparedResult(prepared);
  await reserveClinicName(transaction, clinicId, clinic.name, prepared.clinic.name);
  const notifyPublication = owesPublicationNotice({
    wasPublished: clinic.isPublished,
    willBePublished: prepared.clinic.is_published,
    publishNotifiedAt: clinic.publishNotifiedAt ?? null,
  });
  writeClinicUpdate(transaction, clinicReference, contactReference, prepared.clinic, {
    published: !clinic.isPublished && prepared.clinic.is_published,
    notifyPublication,
  });
  return { status: 'ok', notifyPublication };
}

function storedClinic(
  clinic: z.infer<typeof clinicDocumentSchema>,
  contactEmail: string | null,
): StoredAdminClinic {
  return {
    ...legacyClinicFields(clinic, contactEmail),
    is_published: clinic.isPublished,
    approval_status: clinic.approvalStatus,
  };
}

function preparedResult(
  prepared: Exclude<ReturnType<typeof prepareAdminClinicUpdate>, { allowed: true }>,
): AdminClinicUpdateResult {
  return prepared.reason === 'incomplete'
    ? { status: 'incomplete', missing: prepared.missing }
    : { status: 'unapproved' };
}

/** Publishing also releases the submission mark, so an entry that is withdrawn
 *  and reworked later announces itself to the admin again. */
function publicationMarks(now: Date, notices: { published: boolean; notifyPublication: boolean }) {
  return {
    ...(notices.published ? { submissionNotifiedAt: null } : {}),
    ...(notices.notifyPublication ? { publishNotifiedAt: now } : {}),
  };
}

function writeClinicUpdate(
  transaction: FirebaseFirestore.Transaction,
  clinicReference: FirebaseFirestore.DocumentReference,
  contactReference: FirebaseFirestore.DocumentReference,
  clinic: ClinicAdmin,
  notices: { published: boolean; notifyPublication: boolean },
): void {
  const now = new Date();
  transaction.update(clinicReference, {
    ...clinicUpdateDocument(clinic, now),
    isPublished: clinic.is_published,
    ...publicationMarks(now, notices),
  });
  if (clinic.contact_email) {
    transaction.set(contactReference, { contactEmail: clinic.contact_email });
  } else {
    transaction.delete(contactReference);
  }
}

export async function deleteAdminClinic(clinicIdInput: string): Promise<boolean> {
  const clinicId = z.string().uuid().parse(clinicIdInput);
  const clinic = await readClinic(clinicId);
  if (!clinic) return false;
  await firebaseClinicAccessStore.revoke(clinicId, { unpublish: true, clearContactEmail: true });
  await deleteClinicDependents(clinicId);
  await deleteClinicDocuments(clinicId, clinic.name);
  invalidateClinicCaches();
  return true;
}

async function deleteClinicDependents(clinicId: string): Promise<void> {
  const database = firebaseFirestore();
  await Promise.all([
    deleteQuery(database.collection('clinicEvents').where('clinicId', '==', clinicId)),
    deleteQuery(database.collection(`clinicMetrics/${clinicId}/months`)),
  ]);
}

async function deleteQuery(query: FirebaseFirestore.Query): Promise<void> {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = firebaseFirestore().batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
  }
}

async function deleteClinicDocuments(clinicId: string, name: string): Promise<void> {
  const database = firebaseFirestore();
  const nameReference = database.doc(`uniqueClinicNames/${clinicNameReservationId(name)}`);
  await database.runTransaction(async (transaction) => {
    const reservation = await transaction.get(nameReference);
    if (reservation.data()?.clinicId === clinicId) transaction.delete(nameReference);
    transaction.delete(database.doc(`clinics/${clinicId}`));
    transaction.delete(database.doc(`clinicContacts/${clinicId}`));
    transaction.delete(database.doc(`uniqueClinicOwners/${clinicId}`));
    transaction.delete(database.doc(`claimLimits/${clinicId}`));
  });
}

function invalidateClinicCaches(): void {
  invalidateClinicDirectory();
  invalidateSignupDirectory();
}
