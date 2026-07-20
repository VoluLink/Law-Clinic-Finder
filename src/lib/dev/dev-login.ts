import { z } from 'zod';

/**
 * Dev-only shortcut past email verification for the two seeded test accounts.
 * Never reachable in production: the route that uses this is gated by
 * `devLoginEnabled`, and every address is asserted to sit in the RFC 2606
 * reserved domain, so no real inbox can ever be targeted.
 */

export type DevRole = 'admin' | 'clinic';

const DEV_EMAIL_DOMAIN = '@example.com';
const CLINIC_NAME = 'Start Right e.V.';

export const DEV_ACCOUNTS: Record<DevRole, { email: string; clinicName: string | null }> = {
  admin: { email: `admin${DEV_EMAIL_DOMAIN}`, clinicName: null },
  clinic: { email: `startright${DEV_EMAIL_DOMAIN}`, clinicName: CLINIC_NAME },
};

export const devRoleSchema = z.enum(['admin', 'clinic']);

const linkSchema = z.object({ properties: z.object({ hashed_token: z.string().min(1) }) });

/** Both conditions are required: an unset NODE_ENV must not imply "safe", and
 *  a non-production build must still opt in explicitly. */
export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.DEV_LOGIN_ENABLED === 'true';
}

export function assertDevEmail(email: string): void {
  if (!email.toLowerCase().endsWith(DEV_EMAIL_DOMAIN)) {
    throw new Error(
      `Refusing "${email}": dev logins must use a reserved ${DEV_EMAIL_DOMAIN} address`,
    );
  }
}

/**
 * The single gate for the dev-login route. Returns null for every case the
 * route must answer with 404 — disabled environment or unknown role — so the
 * caller cannot accidentally treat "bad role" as "allowed".
 */
export function parseDevLoginRole(
  rawRole: string | null,
  env: NodeJS.ProcessEnv = process.env,
): DevRole | null {
  if (!devLoginEnabled(env)) return null;
  const parsed = devRoleSchema.safeParse(rawRole);
  return parsed.success ? parsed.data : null;
}

export function buildConfirmPath(hashedToken: string): string {
  return `/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`;
}

// Structural, not the full SupabaseClient: keeps the seam mockable in tests.
type DevClient = {
  auth: {
    admin: {
      createUser: (args: { email: string; email_confirm: boolean }) => Promise<{
        data: { user: { id: string } | null };
        error: { message: string } | null;
      }>;
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null }> };
        error: { message: string } | null;
      }>;
      generateLink: (args: { type: 'magiclink'; email: string }) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase's builder is chainable and differs per table; narrowing it here buys nothing.
};

async function findOrCreateUser(client: DevClient, email: string): Promise<string> {
  const created = await client.auth.admin.createUser({ email, email_confirm: true });
  if (created.data?.user) return created.data.user.id;
  const reason = created.error?.message ?? 'unknown error';
  if (!reason.toLowerCase().includes('already')) {
    throw new Error(`createUser failed for ${email}: ${reason}`);
  }
  // Explicit page size: the default is 50, and the dev account must be found
  // even once the project has more auth users than that.
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`${email} is registered but was not returned by listUsers`);
  return existing.id;
}

/** Resolved by name, not a hardcoded uuid — a renamed or duplicated row should
 *  fail loudly rather than link the wrong clinic. */
async function resolveClinicId(client: DevClient, name: string): Promise<string> {
  const { data, error } = await client.from('clinics').select('id').eq('name', name);
  if (error) throw new Error(`clinic lookup failed: ${error.message}`);
  if (data.length !== 1) {
    throw new Error(`expected exactly 1 clinic named "${name}", found ${data.length}`);
  }
  return data[0].id;
}

/** Seeds the account if absent and returns a fresh magic-link token hash for it. */
export async function ensureDevSession(client: DevClient, role: DevRole): Promise<string> {
  const account = DEV_ACCOUNTS[role];
  assertDevEmail(account.email);
  const userId = await findOrCreateUser(client, account.email);
  const clinicId = account.clinicName ? await resolveClinicId(client, account.clinicName) : null;
  // profiles has no insert/update policy by design; the service client is its
  // only writer (see 20260718090100_profiles.sql).
  const { error } = await client
    .from('profiles')
    .upsert({ user_id: userId, role, clinic_id: clinicId }, { onConflict: 'user_id' });
  if (error) throw new Error(`profile upsert failed for ${account.email}: ${error.message}`);
  const link = await client.auth.admin.generateLink({ type: 'magiclink', email: account.email });
  if (link.error) throw new Error(`generateLink failed: ${link.error.message}`);
  return linkSchema.parse(link.data).properties.hashed_token;
}
