import { FieldPath } from 'firebase-admin/firestore';

import type {
  ClinicDirectoryRepository,
  PublicClinic,
  RecommendationClinic,
} from '@/lib/clinics/directory-repository';

import { firebaseFirestore } from './admin';
import {
  clinicContactDocumentSchema,
  clinicDocumentSchema,
  type ClinicDocument,
} from './documents';

const DIRECTORY_CACHE_MS = 5 * 60 * 1000;

type DirectoryCache = { expiresAt: number; rows: Promise<PublicClinic[]> };

let cache: DirectoryCache | null = null;

function toPublicClinic(id: string, clinic: ClinicDocument): PublicClinic {
  return {
    id,
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    website: clinic.website,
    legal_areas: clinic.legalAreas,
    target_clients: clinic.targetClients,
    languages: clinic.languages,
    requirements: clinic.requirements,
  };
}

async function loadPublishedClinics(): Promise<PublicClinic[]> {
  const snapshot = await firebaseFirestore()
    .collection('clinics')
    .where('isPublished', '==', true)
    .orderBy(FieldPath.documentId())
    .get();
  return snapshot.docs.map((document) =>
    toPublicClinic(document.id, clinicDocumentSchema.parse(document.data())),
  );
}

async function listPublished(): Promise<PublicClinic[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rows;
  const rows = loadPublishedClinics();
  cache = { expiresAt: now + DIRECTORY_CACHE_MS, rows };
  rows.catch(() => {
    if (cache?.rows === rows) cache = null;
  });
  return rows;
}

function recommendation(row: PublicClinic, contactEmail: string | null): RecommendationClinic {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    website: row.website,
    legal_areas: row.legal_areas,
    contact_email: contactEmail,
  };
}

async function findPublishedByIds(ids: string[]): Promise<RecommendationClinic[]> {
  if (ids.length === 0) return [];
  const byId = new Map((await listPublished()).map((clinic) => [clinic.id, clinic]));
  const rows = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const refs = rows.map((row) => firebaseFirestore().collection('clinicContacts').doc(row.id));
  const snapshots = await firebaseFirestore().getAll(...refs);
  return rows.map((row, index) => {
    const data = snapshots[index].data();
    const contact = data ? clinicContactDocumentSchema.parse(data).contactEmail : null;
    return recommendation(row, contact);
  });
}

export function invalidateClinicDirectory(): void {
  cache = null;
}

export const firebaseClinicDirectory: ClinicDirectoryRepository = {
  listPublished,
  findPublishedByIds,
};
