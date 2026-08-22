import { createClient } from '@supabase/supabase-js';

import type { MigrationOptions } from './options';

const PAGE_SIZE = 500;
const MAX_ROWS = 50_000;
const MAX_AUTH_USERS = 10_000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const RETENTION_MS = 366 * 86_400_000;
const LOG_RETENTION_MS = 7 * 86_400_000;

export type SourceDataset = Awaited<ReturnType<typeof readSourceDataset>>;

export async function readAllPages<T>(
  readPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE,
  maxRows = MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length <= maxRows) {
    const page = await readPage(rows.length, rows.length + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error(`Source dataset exceeds the ${maxRows}-row safety limit`);
}

export async function readSourceDataset(options: MigrationOptions, now = new Date()) {
  const client = createSourceClient(options);
  const retentionCutoff = new Date(now.getTime() - RETENTION_MS).toISOString();
  const logCutoff = new Date(now.getTime() - LOG_RETENTION_MS).toISOString();
  const [clinics, profiles, settings, branding, conversations, events, claims, logs, authUsers] =
    await Promise.all([
      readTable((from, to) => tablePage(client, 'clinics', 'id', from, to)),
      readTable((from, to) => tablePage(client, 'profiles', 'user_id', from, to)),
      readTable((from, to) => tablePage(client, 'settings', 'key', from, to)),
      readTable((from, to) => tablePage(client, 'branding', 'id', from, to)),
      readTable((from, to) =>
        retainedPage(client, 'conversations', 'id', retentionCutoff, from, to),
      ),
      readTable((from, to) =>
        retainedPage(client, 'clinic_events', 'id', retentionCutoff, from, to),
      ),
      readTable((from, to) =>
        retainedPage(
          client,
          'claim_requests',
          'id',
          retentionCutoff,
          from,
          to,
          retentionDateColumn('claim_requests'),
        ),
      ),
      readTable((from, to) => retainedPage(client, 'logs', 'id', logCutoff, from, to, 'logged_at')),
      readAuthUsers(client),
    ]);
  if (branding.length !== 1) throw new Error('Expected exactly one source branding row');
  const logo = await readSourceLogo(client, branding[0], options.sourceRef);
  return {
    clinics,
    profiles,
    settings,
    branding: branding[0],
    conversations,
    events,
    claims,
    logs,
    authUsers,
    logo,
  };
}

function createSourceClient(options: Pick<MigrationOptions, 'sourceUrl' | 'sourceSecret'>) {
  return createClient(options.sourceUrl, options.sourceSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SourceClient = ReturnType<typeof createSourceClient>;

async function readTable(readPage: (from: number, to: number) => Promise<unknown[]>) {
  return readAllPages(readPage);
}

async function tablePage(
  client: SourceClient,
  table: string,
  orderColumn: string,
  from: number,
  to: number,
): Promise<unknown[]> {
  const result = await client.from(table).select('*').order(orderColumn).range(from, to);
  if (result.error) throw new Error(`Supabase read failed for ${table}: ${result.error.message}`);
  return result.data ?? [];
}

async function retainedPage(
  client: SourceClient,
  table: string,
  orderColumn: string,
  cutoff: string,
  from: number,
  to: number,
  dateColumn = 'created_at',
): Promise<unknown[]> {
  const result = await client
    .from(table)
    .select('*')
    .gte(dateColumn, cutoff)
    .order(orderColumn)
    .range(from, to);
  if (result.error) throw new Error(`Supabase read failed for ${table}: ${result.error.message}`);
  return result.data ?? [];
}

export function retentionDateColumn(table: string): 'created_at' | 'sent_at' {
  return table === 'claim_requests' ? 'sent_at' : 'created_at';
}

async function readAuthUsers(client: SourceClient): Promise<unknown[]> {
  const users: unknown[] = [];
  for (let page = 1; users.length <= MAX_AUTH_USERS; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    if (result.error) throw new Error(`Supabase Auth read failed: ${result.error.message}`);
    users.push(...result.data.users);
    if (result.data.users.length < 1_000) return users;
  }
  throw new Error(`Source Auth exceeds the ${MAX_AUTH_USERS}-user safety limit`);
}

async function readSourceLogo(
  client: SourceClient,
  branding: unknown,
  sourceRef: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const logoUrl = readLogoUrl(branding);
  if (!logoUrl) return null;
  const path = sourceLogoPath(logoUrl, sourceRef);
  const result = await client.storage.from('branding').download(path);
  if (result.error) throw new Error(`Supabase logo read failed: ${result.error.message}`);
  if (result.data.size > MAX_LOGO_BYTES) throw new Error('Source logo exceeds the size limit');
  return { bytes: Buffer.from(await result.data.arrayBuffer()), contentType: result.data.type };
}

function readLogoUrl(branding: unknown): string | null {
  if (typeof branding !== 'object' || branding === null || !('logo_url' in branding)) {
    throw new Error('Invalid source branding row');
  }
  const value = branding.logo_url;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Invalid source logo URL');
  return value;
}

export function sourceLogoPath(logoUrl: string, sourceRef: string): string {
  const url = new URL(logoUrl);
  const prefix = '/storage/v1/object/public/branding/';
  const validHost = url.protocol === 'https:' && url.hostname === `${sourceRef}.supabase.co`;
  if (!validHost || !url.pathname.startsWith(prefix)) throw new Error('Invalid source logo URL');
  const path = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!path || path.includes('..') || path.includes('\\'))
    throw new Error('Invalid source logo path');
  return path;
}
