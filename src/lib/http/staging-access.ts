import { createHash, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

type Environment = Readonly<Record<string, string | undefined>>;

export type StagingAccessState = 'disabled' | 'granted' | 'denied' | 'misconfigured';

const enabledSchema = z.enum(['true', 'false']).default('false');
const credentialsSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
  password: z
    .string()
    .min(20)
    .max(128)
    .regex(/^[\x21-\x7E]+$/),
});

function parseCredentials(environment: Environment) {
  return credentialsSchema.safeParse({
    username: environment.STAGING_ACCESS_USERNAME,
    password: environment.STAGING_ACCESS_PASSWORD,
  });
}

function valuesMatch(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function stagingAccessState(
  authorization: string | null,
  environment: Environment,
): StagingAccessState {
  const enabled = enabledSchema.safeParse(environment.STAGING_ACCESS_ENABLED);
  if (!enabled.success) return 'misconfigured';
  if (enabled.data === 'false') return 'disabled';
  const credentials = parseCredentials(environment);
  if (!credentials.success) return 'misconfigured';
  const raw = `${credentials.data.username}:${credentials.data.password}`;
  const expected = `Basic ${Buffer.from(raw).toString('base64')}`;
  return valuesMatch(authorization ?? '', expected) ? 'granted' : 'denied';
}
