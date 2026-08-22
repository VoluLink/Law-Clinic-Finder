import 'server-only';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { firebaseAdminAuth } from '@/lib/firebase/admin';

const SESSION_COOKIE = '__session';
const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1_000;

const sessionSchema = z
  .object({
    uid: z.string().min(1),
    email: z.email().optional(),
    auth_time: z.number().int().nonnegative().optional(),
    role: z.enum(['admin', 'clinic']).optional(),
    clinicId: z.string().optional(),
    accessStatus: z.enum(['pending', 'active']).optional(),
  })
  .passthrough();

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

export type SessionCookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: CookieOptions): void;
};

type CreateSessionAuth = {
  createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string>;
};

type VerifySessionAuth = {
  verifySessionCookie(cookie: string, checkRevoked: boolean): Promise<unknown>;
};

function cookieOptions(production: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge };
}

async function nextCookieStore(): Promise<SessionCookieStore> {
  const store = await cookies();
  return {
    get: (name) => store.get(name),
    set: (name, value, options) => store.set(name, value, options),
  };
}

export async function createSessionCookie(
  idToken: string,
  deps?: { auth: CreateSessionAuth; store: SessionCookieStore; production: boolean },
) {
  const auth = deps?.auth ?? firebaseAdminAuth();
  const store = deps?.store ?? (await nextCookieStore());
  const production = deps?.production ?? process.env.NODE_ENV === 'production';
  const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  store.set(SESSION_COOKIE, session, cookieOptions(production, SESSION_MAX_AGE_SECONDS));
}

export async function readSessionCookie(deps?: {
  auth: VerifySessionAuth;
  store: SessionCookieStore;
  checkRevoked?: boolean;
}) {
  const store = deps?.store ?? (await nextCookieStore());
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const auth = deps?.auth ?? firebaseAdminAuth();
    const decoded = await auth.verifySessionCookie(session, deps?.checkRevoked ?? true);
    const parsed = sessionSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie(store: SessionCookieStore, production: boolean): void {
  store.set(SESSION_COOKIE, '', cookieOptions(production, 0));
}

export async function clearFirebaseSession(): Promise<void> {
  clearSessionCookie(await nextCookieStore(), process.env.NODE_ENV === 'production');
}
