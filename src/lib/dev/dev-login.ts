import { z } from 'zod';

export type DevRole = 'admin' | 'clinic';

const DEV_EMAIL_DOMAIN = '@example.com';
const CLINIC_NAME = 'Start Right e.V.';
const loopbackSchema = z.string().regex(/^(?:127\.0\.0\.1|localhost):\d{2,5}$/);

export type DevAccount = { email: string; clinicName: string | null };

export const DEV_ACCOUNTS: Record<DevRole, DevAccount> = {
  admin: { email: `admin${DEV_EMAIL_DOMAIN}`, clinicName: null },
  clinic: { email: `startright${DEV_EMAIL_DOMAIN}`, clinicName: CLINIC_NAME },
};

export const devRoleSchema = z.enum(['admin', 'clinic']);

export type DevLoginStore = {
  ensureIdentity(
    role: DevRole,
    account: DevAccount,
  ): Promise<{ userId: string; clinicId: string | null }>;
  generateActionCode(email: string): Promise<string>;
};

export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production' || env.DEV_LOGIN_ENABLED !== 'true') return false;
  return (
    loopbackSchema.safeParse(env.FIREBASE_AUTH_EMULATOR_HOST).success &&
    loopbackSchema.safeParse(env.FIRESTORE_EMULATOR_HOST).success
  );
}

export function assertDevEmail(email: string): void {
  if (!email.toLowerCase().endsWith(DEV_EMAIL_DOMAIN)) {
    throw new Error(
      `Refusing "${email}": dev logins must use a reserved ${DEV_EMAIL_DOMAIN} address`,
    );
  }
}

export function parseDevLoginRole(
  rawRole: string | null,
  env: NodeJS.ProcessEnv = process.env,
): DevRole | null {
  if (!devLoginEnabled(env)) return null;
  const parsed = devRoleSchema.safeParse(rawRole);
  return parsed.success ? parsed.data : null;
}

export async function ensureDevSession(store: DevLoginStore, role: DevRole) {
  const account = DEV_ACCOUNTS[role];
  assertDevEmail(account.email);
  const identity = await store.ensureIdentity(role, account);
  const actionCode = await store.generateActionCode(account.email);
  return {
    email: account.email,
    userId: identity.userId,
    actionCode,
    destination: role === 'admin' ? '/admin' : '/clinic',
  };
}
