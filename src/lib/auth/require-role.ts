import { z } from 'zod';

import { readProfile } from '@/lib/firebase/profile-repository';
import { readSessionCookie } from '@/lib/firebase/session';

export const profileSchema = z.object({
  role: z.enum(['admin', 'clinic']),
  clinic_id: z.string().nullable(),
  access_status: z.enum(['pending', 'active']),
  activated_at: z.string().nullable().optional(),
});

export type Profile = z.infer<typeof profileSchema>;
export type AuthenticatedProfile = Profile & {
  user_id: string;
  email?: string;
  auth_time?: number;
};

type RoleDependencies = {
  readSession(): Promise<{ uid: string; email?: string; auth_time?: number } | null>;
  readProfile(userId: string): Promise<unknown>;
};

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function defaultDependencies(): Promise<RoleDependencies> {
  return {
    readSession: readSessionCookie,
    readProfile,
  };
}

export async function requireRole(
  allowed: Array<Profile['role']>,
  dependencies?: RoleDependencies,
): Promise<AuthenticatedProfile> {
  const deps = dependencies ?? (await defaultDependencies());
  const session = await deps.readSession();
  if (!session) throw new AuthError('not signed in', 401);
  const parsed = profileSchema.safeParse(await deps.readProfile(session.uid));
  if (!parsed.success || !allowed.includes(parsed.data.role)) {
    throw new AuthError('insufficient role', 403);
  }
  return {
    ...parsed.data,
    user_id: session.uid,
    ...(session.email ? { email: session.email } : {}),
    ...(session.auth_time !== undefined ? { auth_time: session.auth_time } : {}),
  };
}

export async function requireActiveRole(
  allowed: Array<Profile['role']>,
  dependencies?: RoleDependencies,
): Promise<AuthenticatedProfile> {
  const profile = await requireRole(allowed, dependencies);
  if (profile.access_status !== 'active') throw new AuthError('access pending approval', 403);
  return profile;
}
