import type { Profile } from './require-role';
import { profileSchema } from './require-role';
import type { EmailStateRecord } from './email-state';

type ExchangeResult = { idToken: string; userId: string; email: string };

export type EmailSignInDependencies = {
  consumeState: (state: string, actionCode: string) => Promise<EmailStateRecord | null>;
  exchange: (email: string, actionCode: string) => Promise<ExchangeResult>;
  readProfile: (userId: string) => Promise<unknown>;
  activateFirstAccess: (userId: string) => Promise<void>;
  createSession: (idToken: string) => Promise<void>;
};

export function destinationFor(profile: Profile): string {
  if (profile.role === 'admin') return '/admin';
  return profile.access_status === 'pending' ? '/clinic/pending' : '/clinic';
}

function identityMatches(record: EmailStateRecord, exchanged: ExchangeResult): boolean {
  return (
    record.userId === exchanged.userId &&
    record.email.toLowerCase() === exchanged.email.toLowerCase()
  );
}

export async function completeEmailSignIn(
  state: string,
  actionCode: string,
  dependencies: EmailSignInDependencies,
) {
  const record = await dependencies.consumeState(state, actionCode);
  if (!record || record.purpose === 'email_change') {
    return { ok: false as const, reason: 'invalid_link' as const };
  }
  const exchanged = await dependencies.exchange(record.email, actionCode);
  if (!identityMatches(record, exchanged)) {
    return { ok: false as const, reason: 'identity_mismatch' as const };
  }
  const parsed = profileSchema.safeParse(await dependencies.readProfile(exchanged.userId));
  if (!parsed.success) return { ok: false as const, reason: 'no_access' as const };
  const profile = parsed.data;
  if (profile.role === 'clinic' && profile.access_status === 'active' && !profile.activated_at) {
    await dependencies.activateFirstAccess(exchanged.userId);
  }
  await dependencies.createSession(exchanged.idToken);
  return {
    ok: true as const,
    userId: exchanged.userId,
    role: profile.role,
    destination: destinationFor(profile),
  };
}
