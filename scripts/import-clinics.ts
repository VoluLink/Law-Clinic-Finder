import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { Firestore } from '@google-cloud/firestore';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { clinicNameReservationId } from '../src/lib/clinics/name-reservation';
import { publicWebsiteUrlSchema } from '../src/lib/clinics/schema';
import { clinicDocumentSchema } from '../src/lib/firebase/documents';

const TARGET_PROJECT = 'law-clinic-finder';
const TARGET_DATABASE = 'primary-eu';

const clinicImportSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2_000).nullable().default(null),
  website: publicWebsiteUrlSchema.nullable(),
  region: z.string().max(1_000).nullable(),
  legal_areas: z.string().max(2_000),
  target_clients: z.string().max(2_000).nullable(),
  languages: z.string().max(1_000).nullable(),
  requirements: z.string().max(4_000).nullable(),
  advises_clients: z.boolean().default(true),
  is_published: z.boolean(),
});

type ImportedClinic = z.infer<typeof clinicImportSchema>;

export function parseClinicImport(input: unknown): ImportedClinic[] {
  const rows = z.array(clinicImportSchema).max(1_000).parse(input);
  const ids = rows.map((row) => clinicNameReservationId(row.name));
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate normalized clinic name');
  return rows;
}

export function parseClinicImportArguments(args: string[]) {
  let jsonPath: string | undefined;
  let confirmation: string | undefined;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') apply = true;
    else if (argument === '--confirm-target') {
      confirmation = args[index + 1];
      if (!confirmation || confirmation.startsWith('--')) throw new Error('Missing target value');
      index += 1;
    } else if (argument.startsWith('--')) throw new Error(`Unknown argument: ${argument}`);
    else if (jsonPath) throw new Error('Only one clinics JSON file is allowed');
    else jsonPath = argument;
  }
  if (!jsonPath) throw new Error('A clinics JSON file is required');
  if (apply && confirmation !== TARGET_PROJECT) {
    throw new Error(`--confirm-target ${TARGET_PROJECT} is required with --apply`);
  }
  return { jsonPath, apply };
}

async function readClinics(jsonPath: string): Promise<ImportedClinic[]> {
  const contents = await readFile(jsonPath, 'utf8');
  return parseClinicImport(JSON.parse(contents));
}

function firebaseDatabase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (projectId !== TARGET_PROJECT)
    throw new Error(`FIREBASE_PROJECT_ID must be ${TARGET_PROJECT}`);
  const databaseId = process.env.FIREBASE_DATABASE_ID;
  if (databaseId !== TARGET_DATABASE)
    throw new Error(`FIREBASE_DATABASE_ID must be ${TARGET_DATABASE}`);
  initializeApp({ credential: applicationDefault(), projectId }, 'clinic-import');
  return new Firestore({ projectId, databaseId });
}

async function importClinic(
  database: FirebaseFirestore.Firestore,
  clinic: ImportedClinic,
): Promise<void> {
  const reservationId = clinicNameReservationId(clinic.name);
  const reservation = database.doc(`uniqueClinicNames/${reservationId}`);
  await database.runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(reservation);
    const clinicId = existingClinicId(reservationSnapshot.data()) ?? randomUUID();
    const clinicReference = database.doc(`clinics/${clinicId}`);
    const currentSnapshot = await transaction.get(clinicReference);
    const current = currentSnapshot.exists
      ? clinicDocumentSchema.parse(currentSnapshot.data())
      : null;
    const now = Timestamp.now();
    transaction.set(clinicReference, clinicDocument(clinic, current, now));
    transaction.set(reservation, { clinicId, name: clinic.name, updatedAt: now });
  });
}

function existingClinicId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('clinicId' in data)) return null;
  return z.string().uuid().parse(data.clinicId);
}

function clinicDocument(
  clinic: ImportedClinic,
  current: z.infer<typeof clinicDocumentSchema> | null,
  now: Timestamp,
) {
  return {
    name: clinic.name,
    description: clinic.description,
    region: clinic.region,
    website: clinic.website,
    legalAreas: clinic.legal_areas,
    targetClients: clinic.target_clients,
    languages: clinic.languages,
    requirements: clinic.requirements,
    advisesClients: clinic.advises_clients,
    isPublished: current?.isPublished ?? clinic.is_published,
    approvalStatus: current?.approvalStatus ?? 'approved',
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
}

async function main(): Promise<void> {
  const options = parseClinicImportArguments(process.argv.slice(2));
  const clinics = await readClinics(options.jsonPath);
  if (options.apply) {
    const database = firebaseDatabase();
    for (const clinic of clinics) await importClinic(database, clinic);
  }
  process.stdout.write(
    `${JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', clinics: clinics.length })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Clinic import failed'}\n`);
    process.exitCode = 1;
  });
}
