import { FieldPath } from 'firebase-admin/firestore';

import type { DirectoryMatch } from '@/lib/signup/directory';
import type { SignupDirectoryStore } from '@/lib/signup/handle-search';

import { firebaseFirestore } from './admin';
import { clinicContactDocumentSchema, clinicDocumentSchema } from './documents';

const MAX_RESULTS = 200;

/**
 * A claimant knows their clinic's name, so a short term and a small page are
 * enough to find it. Both numbers exist to stop the search doubling as a
 * directory export.
 */
const MIN_QUERY_CHARS = 3;
const MAX_MATCHES = 10;
const CACHE_MS = 5 * 60 * 1000;

type Cache = { expiresAt: number; rows: Promise<DirectoryMatch[]> };

let cache: Cache | null = null;

async function loadApprovedDirectory(): Promise<DirectoryMatch[]> {
  const database = firebaseFirestore();
  const clinics = await database
    .collection('clinics')
    .where('approvalStatus', '==', 'approved')
    .orderBy('name')
    .orderBy(FieldPath.documentId())
    .limit(MAX_RESULTS)
    .get();
  if (clinics.empty) return [];
  const contacts = await database.getAll(
    ...clinics.docs.map((clinic) => database.collection('clinicContacts').doc(clinic.id)),
  );
  const owners = await database.getAll(
    ...clinics.docs.map((clinic) => database.collection('uniqueClinicOwners').doc(clinic.id)),
  );
  return clinics.docs.map((document, index) => {
    const clinic = clinicDocumentSchema.parse(document.data());
    const contactData = contacts[index].data();
    const email = contactData ? clinicContactDocumentSchema.parse(contactData).contactEmail : null;
    return {
      id: document.id,
      name: clinic.name,
      region: clinic.region,
      claimed: owners[index].exists,
      hasContactEmail: Boolean(email),
    };
  });
}

async function cachedDirectory(): Promise<DirectoryMatch[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rows;
  const rows = loadApprovedDirectory();
  cache = { expiresAt: now + CACHE_MS, rows };
  rows.catch(() => {
    if (cache?.rows === rows) cache = null;
  });
  return rows;
}

/** Extracted so the bounds can be tested without standing up Firestore. */
export function matchDirectory(rows: DirectoryMatch[], query: string): DirectoryMatch[] {
  const term = query.trim().toLocaleLowerCase('de');
  if (term.length < MIN_QUERY_CHARS) return [];
  return rows
    .filter((row) => row.name.toLocaleLowerCase('de').includes(term))
    .slice(0, MAX_MATCHES);
}

async function search(query: string): Promise<DirectoryMatch[]> {
  if (query.trim().length < MIN_QUERY_CHARS) return [];
  return matchDirectory(await cachedDirectory(), query);
}

export const SIGNUP_SEARCH_LIMITS = { minQueryChars: MIN_QUERY_CHARS, maxMatches: MAX_MATCHES };

export function invalidateSignupDirectory(): void {
  cache = null;
}

export const firebaseSignupDirectory: SignupDirectoryStore = { search };
