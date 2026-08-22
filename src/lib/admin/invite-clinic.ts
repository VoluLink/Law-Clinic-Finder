import type { ClinicInvite } from '@/lib/clinics/schema';
import type { Logger } from '@/lib/logger';

export type AccessStatus = 'pending' | 'active';

export type InviteResult =
  | { status: 'ok'; clinicId: string }
  | { status: 'invite_failed'; clinicId: string }
  | { status: 'already_invited' }
  | { status: 'error'; reason: string };

type LinkResult = 'ok' | 'already_invited' | 'invite_failed';
type ClinicInviteState = { email: string; userId: string | null };

export type ClinicInviteStore = {
  createClinic: (invite: ClinicInvite) => Promise<string>;
  readInviteState: (clinicId: string) => Promise<ClinicInviteState | null>;
  createAndLinkUser: (
    clinicId: string,
    email: string,
    accessStatus: AccessStatus,
  ) => Promise<LinkResult>;
  resendInvite: (clinicId: string, userId: string, email: string) => Promise<LinkResult>;
};

export type InviteDeps = { store: ClinicInviteStore; logger: Logger };

export async function inviteClinic(deps: InviteDeps, invite: ClinicInvite): Promise<InviteResult> {
  let clinicId: string;
  try {
    clinicId = await deps.store.createClinic(invite);
  } catch (error) {
    deps.logger.warn('clinic insert failed', { reason: errorMessage(error) });
    return { status: 'error', reason: 'clinic insert failed' };
  }
  return linkInvitedUser(deps, clinicId, invite.contact_email);
}

export async function reinviteClinic(deps: InviteDeps, clinicId: string): Promise<InviteResult> {
  const state = await deps.store.readInviteState(clinicId);
  if (!state) return { status: 'error', reason: 'clinic has no contact email' };
  const result = state.userId
    ? await deps.store.resendInvite(clinicId, state.userId, state.email)
    : await deps.store.createAndLinkUser(clinicId, state.email, 'active');
  return toInviteResult(result, clinicId);
}

export async function linkInvitedUser(
  deps: InviteDeps,
  clinicId: string,
  email: string,
  accessStatus: AccessStatus = 'active',
): Promise<InviteResult> {
  try {
    const result = await deps.store.createAndLinkUser(clinicId, email, accessStatus);
    return toInviteResult(result, clinicId);
  } catch (error) {
    deps.logger.error('profile link failed', { clinicId, reason: errorMessage(error) });
    return { status: 'error', reason: 'profile insert failed' };
  }
}

function toInviteResult(result: LinkResult, clinicId: string): InviteResult {
  if (result === 'ok') return { status: 'ok', clinicId };
  if (result === 'invite_failed') return { status: 'invite_failed', clinicId };
  return { status: 'already_invited' };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
