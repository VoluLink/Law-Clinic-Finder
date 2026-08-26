import 'server-only';

import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';

import {
  googleLocationSchema,
  googleProjectIdSchema,
  googleSecretIdSchema,
  googleSecretVersionSchema,
} from '@/lib/google/resource-names';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * A regional secret lives under `projects/*​/locations/*​/secrets/*` and is only
 * reachable through its regional endpoint; a global secret omits the location.
 * Both shapes are supported so the deployed secret decides, not this code.
 */
export type SecretReference = {
  projectId: string;
  secretId: string;
  location: string | null;
};

/**
 * A reference that cannot be turned into a URL safely. Separate from
 * SecretManagerError because nothing was sent: this is deployment
 * configuration, and no access token has left the process.
 */
export class SecretConfigurationError extends Error {
  constructor(readonly field: string) {
    super(`Secret Manager reference has an invalid ${field}`);
    this.name = 'SecretConfigurationError';
  }
}

export class SecretManagerError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
  ) {
    super(`Secret Manager ${operation} failed with status ${status}`);
    this.name = 'SecretManagerError';
  }
}

export type SecretVersion = { id: string; enabled: boolean };

const accessSchema = z.object({ payload: z.object({ data: z.string() }) });
const versionListSchema = z.object({
  versions: z
    .array(z.object({ name: z.string().min(1), state: z.string().min(1) }))
    .optional()
    .default([]),
});
const addVersionSchema = z.object({ name: z.string().min(1) });

const referenceSchema = z.object({
  projectId: googleProjectIdSchema,
  secretId: googleSecretIdSchema,
  location: googleLocationSchema.nullable(),
});

/**
 * The one place a reference becomes a URL, so it is the one place that has to
 * check. `location` picks the host, not just a path segment, and every call
 * made from here carries a cloud-platform access token.
 */
function secretUrl(secret: SecretReference, suffix: string): string {
  const parsed = referenceSchema.safeParse(secret);
  if (!parsed.success) {
    throw new SecretConfigurationError(parsed.error.issues[0]?.path.join('.') || 'reference');
  }
  const { projectId, secretId, location } = parsed.data;
  const host = location
    ? `secretmanager.${location}.rep.googleapis.com`
    : 'secretmanager.googleapis.com';
  const scope = location ? `projects/${projectId}/locations/${location}` : `projects/${projectId}`;
  return `https://${host}/v1/${scope}/secrets/${secretId}${suffix}`;
}

/** The trailing path segment is the numeric version id Secret Manager assigns. */
function versionId(resourceName: string): string {
  return resourceName.slice(resourceName.lastIndexOf('/') + 1);
}

let auth: GoogleAuth | null = null;

async function authorization(): Promise<string> {
  auth ??= new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  const token = await auth.getAccessToken();
  if (!token) throw new SecretManagerError(401, 'authentication');
  return `Bearer ${token}`;
}

type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; allowNotFound?: boolean };

async function call<T>(
  url: string,
  schema: z.ZodType<T>,
  operation: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      authorization: await authorization(),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (response.status === 404 && options.allowNotFound) return null;
  if (!response.ok) throw new SecretManagerError(response.status, operation);
  return schema.parse(await response.json());
}

/** Returns the decoded payload, or null when the version does not exist. */
export async function accessSecretVersion(
  secret: SecretReference,
  version: string,
): Promise<string | null> {
  const requested = googleSecretVersionSchema.safeParse(version);
  if (!requested.success) throw new SecretConfigurationError('version');
  const url = secretUrl(secret, `/versions/${requested.data}:access`);
  const result = await call(url, accessSchema, 'access', { allowNotFound: true });
  return result ? Buffer.from(result.payload.data, 'base64').toString('utf8') : null;
}

/** Enabled version ids, newest first. Null means the secret does not exist. */
export async function listEnabledVersions(secret: SecretReference): Promise<string[] | null> {
  const url = secretUrl(secret, '/versions?pageSize=10');
  const result = await call(url, versionListSchema, 'list', { allowNotFound: true });
  if (!result) return null;
  return result.versions
    .filter((version) => version.state === 'ENABLED')
    .map((version) => versionId(version.name));
}

export async function addSecretVersion(
  secret: SecretReference,
  payload: string,
): Promise<string | null> {
  const url = secretUrl(secret, ':addVersion');
  const body = { payload: { data: Buffer.from(payload, 'utf8').toString('base64') } };
  const result = await call(url, addVersionSchema, 'addVersion', {
    method: 'POST',
    body,
    allowNotFound: true,
  });
  return result ? versionId(result.name) : null;
}
