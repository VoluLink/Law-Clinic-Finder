import { createHash } from 'node:crypto';

import { normalizeLogo } from '../../src/lib/branding/logo';
import { clinicNameReservationId } from '../../src/lib/clinics/name-reservation';
import { DEV_ACCOUNTS } from '../../src/lib/dev/dev-login';
import { emailReservationId } from '../../src/lib/firebase/identity-reservations';
import type { SourceDataset } from './source';
import {
  buildAdminMetrics,
  buildClaimLimits,
  buildClinicMetrics,
  checksumRecords,
  transformAuthUser,
  transformBranding,
  transformClinic,
  transformClinicEvent,
  transformConversation,
  transformLog,
  transformProfile,
  transformSettings,
} from './transforms';

const MIGRATED_LOGO_PATH = 'branding/logo-00000000-0000-4000-8000-000000000001.png';
const TRANSCRIPT_CAP = 200;
const RESERVED_DEV_EMAILS = new Set(
  Object.values(DEV_ACCOUNTS).map((account) => account.email.toLowerCase()),
);

export type MigrationDocument = { path: string; data: Record<string, unknown> };
export type PreparedAuthUser = ReturnType<typeof transformAuthUser> & {
  customClaims?: ReturnType<typeof transformProfile>['claims'];
};
export type MigrationPhase = {
  name: string;
  documents: MigrationDocument[];
  checksum: string;
  documentChecksum: string;
};

export type MigrationBundle = {
  phases: MigrationPhase[];
  authUsers: PreparedAuthUser[];
  logo: Buffer | null;
};

type TransformedClinic = ReturnType<typeof transformClinic>;
type TransformedConversation = ReturnType<typeof transformConversation>;

export async function prepareMigration(
  source: SourceDataset,
  now = new Date(),
): Promise<MigrationBundle> {
  const clinics = source.clinics.map(transformClinic);
  const core = prepareCorePhase(clinics);
  const identity = prepareIdentityPhase(
    source.authUsers,
    source.profiles,
    new Set(clinics.map((row) => row.id)),
  );
  const recommendationIds = recommendationIdsByConversation(source.events);
  const conversations = source.conversations.map((row) =>
    transformConversation(row, recommendationIds.get(sourceConversationId(row)) ?? []),
  );
  const logo = source.logo ? await normalizeLogo(source.logo.bytes, source.logo.contentType) : null;
  return {
    phases: [
      core,
      identity.phase,
      prepareConfigurationPhase(source, logo),
      prepareConversationPhase(conversations),
      prepareAnalyticsPhase(source.events, conversations),
      prepareOperationsPhase(source.claims, source.logs, now),
    ],
    authUsers: identity.authUsers,
    logo,
  };
}

export function prepareCorePhase(clinics: TransformedClinic[]): MigrationPhase {
  const documents = clinics.flatMap((row) => {
    const nameId = clinicNameReservationId(row.clinic.name);
    const reservation = {
      clinicId: row.id,
      name: row.clinic.name,
      updatedAt: row.clinic.updatedAt,
    };
    return compactDocuments([
      { path: `clinics/${row.id}`, data: row.clinic },
      row.contact ? { path: `clinicContacts/${row.id}`, data: row.contact } : null,
      { path: `uniqueClinicNames/${nameId}`, data: reservation },
    ]);
  });
  return phase('clinics', documents);
}

export function prepareIdentityPhase(
  authInputs: unknown[],
  profileInputs: unknown[],
  clinicIds: Set<string>,
): { phase: MigrationPhase; authUsers: PreparedAuthUser[] } {
  const transformedUsers = authInputs.map((input) => transformAuthUser(input));
  const reservedUserIds = new Set(
    transformedUsers.filter((user) => RESERVED_DEV_EMAILS.has(user.email)).map((user) => user.uid),
  );
  const profiles = profileInputs
    .map(transformProfile)
    .filter((profile) => !reservedUserIds.has(profile.id));
  assertProfileReferences(profiles, clinicIds);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const authUsers = transformedUsers
    .filter((user) => !reservedUserIds.has(user.uid))
    .map((user) => withClaims(user, profileById));
  const emailById = new Map(authUsers.map((user) => [user.uid, user.email]));
  assertIdentityReferences(profiles, emailById);
  const documents = identityDocuments(profiles, emailById);
  return { phase: phase('identities', documents), authUsers };
}

function withClaims(
  user: ReturnType<typeof transformAuthUser>,
  profiles: Map<string, ReturnType<typeof transformProfile>>,
): PreparedAuthUser {
  const claims = profiles.get(user.uid)?.claims;
  return claims ? { ...user, customClaims: claims } : user;
}

function identityDocuments(
  profiles: ReturnType<typeof transformProfile>[],
  emailById: Map<string, string>,
): MigrationDocument[] {
  const documents: MigrationDocument[] = [];
  const clinicOwners = new Set<string>();
  for (const row of profiles) {
    const email = emailById.get(row.id)!;
    documents.push({ path: `profiles/${row.id}`, data: row.profile });
    documents.push(emailOwnerDocument(row.id, row.profile.role, email, row.profile.updatedAt));
    if (row.profile.clinicId) {
      if (clinicOwners.has(row.profile.clinicId)) throw new Error('Clinic has multiple profiles');
      clinicOwners.add(row.profile.clinicId);
      documents.push(clinicOwnerDocument(row.profile.clinicId, row.id, row.profile.updatedAt));
    }
  }
  const admins = profiles.filter((row) => row.profile.role === 'admin');
  if (admins.length === 0) throw new Error('Source has no admin profile');
  documents.push({
    path: 'adminState/current',
    data: { count: admins.length, updatedAt: latestProfileDate(admins) },
  });
  return documents;
}

function emailOwnerDocument(userId: string, role: string, email: string, updatedAt: Date) {
  return {
    path: `emailOwners/${emailReservationId(email)}`,
    data: { userId, role, updatedAt },
  };
}

function clinicOwnerDocument(clinicId: string, userId: string, updatedAt: Date) {
  return { path: `uniqueClinicOwners/${clinicId}`, data: { userId, updatedAt } };
}

function latestProfileDate(profiles: ReturnType<typeof transformProfile>[]): Date {
  return new Date(Math.max(...profiles.map((row) => row.profile.updatedAt.getTime())));
}

function assertProfileReferences(
  profiles: ReturnType<typeof transformProfile>[],
  clinicIds: Set<string>,
): void {
  const missing = profiles.find(
    (row) => row.profile.clinicId && !clinicIds.has(row.profile.clinicId),
  );
  if (missing) throw new Error(`Profile ${missing.id} references a missing clinic`);
}

function assertIdentityReferences(
  profiles: ReturnType<typeof transformProfile>[],
  emailById: Map<string, string>,
): void {
  const missing = profiles.find((row) => !emailById.has(row.id));
  if (missing) throw new Error(`Profile ${missing.id} references a missing Auth user`);
  if (new Set(emailById.values()).size !== emailById.size)
    throw new Error('Auth e-mails are not unique');
}

function prepareConfigurationPhase(source: SourceDataset, logo: Buffer | null): MigrationPhase {
  const settings = transformSettings(source.settings);
  const branding = transformBranding(source.branding, logo ? MIGRATED_LOGO_PATH : null);
  const documents = [
    { path: 'settings/chat', data: settings },
    { path: 'branding/current', data: branding },
  ];
  const checksumInput = logo ? [...documents, { logoSha256: sha256(logo) }] : documents;
  return { ...phase('configuration', documents), checksum: checksumRecords(checksumInput) };
}

function prepareConversationPhase(conversations: TransformedConversation[]): MigrationPhase {
  const retained = new Set(retainedTranscriptIds(conversations));
  const documents = conversations.flatMap((row) => {
    const keepTranscript = retained.has(row.id) && row.transcript !== null;
    return compactDocuments([
      { path: `conversations/${row.id}`, data: { ...row.summary, hasTranscript: keepTranscript } },
      keepTranscript ? { path: `conversationTranscripts/${row.id}`, data: row.transcript! } : null,
    ]);
  });
  documents.push(retentionDocument(conversations, retained));
  return phase('conversations', documents);
}

export function retainedTranscriptIds(conversations: TransformedConversation[]): string[] {
  return conversations
    .filter((row) => row.transcript !== null)
    .sort((left, right) => left.summary.createdAt.getTime() - right.summary.createdAt.getTime())
    .slice(-TRANSCRIPT_CAP)
    .map((row) => row.id);
}

function retentionDocument(
  conversations: TransformedConversation[],
  retained: Set<string>,
): MigrationDocument {
  const rows = conversations
    .filter((row) => retained.has(row.id))
    .sort((left, right) => left.summary.createdAt.getTime() - right.summary.createdAt.getTime());
  const entries = rows.map((row) => ({ id: row.id, createdAtMs: row.summary.createdAt.getTime() }));
  const updatedAt = rows.at(-1)?.summary.updatedAt ?? new Date(0);
  return { path: 'retention/conversationTranscripts', data: { entries, updatedAt } };
}

function prepareAnalyticsPhase(
  eventInputs: unknown[],
  conversations: TransformedConversation[],
): MigrationPhase {
  const eventDocuments = eventInputs.map(transformClinicEvent).map((row) => ({
    path: `clinicEvents/${row.id}`,
    data: row.event,
  }));
  const adminMetrics = [...buildAdminMetrics(conversations)].map(([month, data]) => ({
    path: `adminMetrics/${month}`,
    data,
  }));
  const clinicMetrics = [...buildClinicMetrics(eventInputs)].map(([key, data]) => {
    const [clinicId, month] = key.split('/');
    return { path: `clinicMetrics/${clinicId}/months/${month}`, data };
  });
  return phase('analytics', [...eventDocuments, ...adminMetrics, ...clinicMetrics]);
}

function prepareOperationsPhase(
  claimInputs: unknown[],
  logInputs: unknown[],
  now: Date,
): MigrationPhase {
  const claims = [...buildClaimLimits(claimInputs, now)].map(([clinicId, data]) => ({
    path: `claimLimits/${clinicId}`,
    data,
  }));
  const logs = logInputs.map(transformLog).map((row) => ({
    path: `logs/${row.id}`,
    data: row.log,
  }));
  return phase('operations', [...claims, ...logs]);
}

function recommendationIdsByConversation(events: unknown[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const input of events) {
    const row = transformClinicEvent(input);
    if (row.event.kind !== 'recommended' || !row.event.conversationId) continue;
    const current = grouped.get(row.event.conversationId) ?? [];
    grouped.set(row.event.conversationId, [...new Set([...current, row.event.clinicId])]);
  }
  return grouped;
}

function sourceConversationId(input: unknown): string {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('id' in input) ||
    typeof input.id !== 'string'
  ) {
    throw new Error('Source conversation has no ID');
  }
  return input.id;
}

function phase(name: string, documents: MigrationDocument[]): MigrationPhase {
  const sorted = [...documents].sort((left, right) => left.path.localeCompare(right.path));
  const duplicate = sorted.find((document, index) => document.path === sorted[index - 1]?.path);
  if (duplicate) throw new Error(`Duplicate target document: ${duplicate.path}`);
  const documentChecksum = checksumRecords(sorted);
  return { name, documents: sorted, checksum: documentChecksum, documentChecksum };
}

function compactDocuments(documents: Array<MigrationDocument | null>): MigrationDocument[] {
  return documents.filter((document): document is MigrationDocument => document !== null);
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
