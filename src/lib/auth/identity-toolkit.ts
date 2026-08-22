import 'server-only';

import { z } from 'zod';

import { firebaseConfig } from '@/lib/firebase/env';

const exchangeResponseSchema = z.object({
  idToken: z.string().min(1),
  localId: z.string().min(1),
  email: z.email(),
});

const emailChangeResponseSchema = z.object({
  localId: z.string().min(1),
  email: z.email(),
});

const loopbackHostSchema = z.string().regex(/^(?:127\.0\.0\.1|localhost):\d{2,5}$/);

type ExchangeDependencies = {
  fetcher: typeof fetch;
  endpoint: string;
};

export class AuthExchangeError extends Error {
  constructor() {
    super('Email sign-in exchange failed');
    this.name = 'AuthExchangeError';
  }
}

function identityToolkitEndpoint(path: string): string {
  const config = firebaseConfig();
  const emulator = loopbackHostSchema.safeParse(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const base =
    emulator.success && process.env.NODE_ENV !== 'production'
      ? `http://${emulator.data}/identitytoolkit.googleapis.com`
      : 'https://identitytoolkit.googleapis.com';
  const url = new URL(path, base);
  url.searchParams.set('key', config.webApiKey);
  return url.toString();
}

function defaultDependencies(): ExchangeDependencies {
  return { fetcher: fetch, endpoint: identityToolkitEndpoint('/v1/accounts:signInWithEmailLink') };
}

export async function applyEmailChangeCode(
  actionCode: string,
  dependencies: ExchangeDependencies = {
    fetcher: fetch,
    endpoint: identityToolkitEndpoint('/v1/accounts:update'),
  },
) {
  const oobCode = z.string().min(10).max(2_000).parse(actionCode);
  const response = await dependencies.fetcher(dependencies.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ oobCode }),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new AuthExchangeError();
  const parsed = emailChangeResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new AuthExchangeError();
  return { userId: parsed.data.localId, email: parsed.data.email };
}

export async function exchangeEmailLink(
  email: string,
  actionCode: string,
  dependencies: ExchangeDependencies = defaultDependencies(),
) {
  const input = z
    .object({ email: z.email().max(200), oobCode: z.string().min(10).max(2_000) })
    .parse({ email, oobCode: actionCode });
  const response = await dependencies.fetcher(dependencies.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new AuthExchangeError();
  const parsed = exchangeResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new AuthExchangeError();
  return { idToken: parsed.data.idToken, userId: parsed.data.localId, email: parsed.data.email };
}
