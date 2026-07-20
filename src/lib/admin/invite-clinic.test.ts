import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@/lib/logger';

import { inviteClinic, type InviteDeps } from './invite-clinic';

const invite = { name: 'Neue Clinic', contact_email: 'org@clinic.de' };

function createDeps(overrides?: {
  clinicError?: boolean;
  inviteError?: boolean;
  profileError?: boolean;
}) {
  const profileInsert = vi
    .fn()
    .mockResolvedValue({ error: overrides?.profileError ? { message: 'boom' } : null });
  const clinicInsert = vi.fn(() => ({
    select: () => ({
      single: async () =>
        overrides?.clinicError
          ? { data: null, error: { message: 'dup' } }
          : { data: { id: 'clinic-1' }, error: null },
    }),
  }));
  const inviteUserByEmail = vi.fn(async () =>
    overrides?.inviteError
      ? { data: { user: null }, error: { message: 'smtp down' } }
      : { data: { user: { id: 'user-1' } }, error: null },
  );
  const deps: InviteDeps = {
    adminClient: {
      from: (table: string) =>
        table === 'clinics' ? { insert: clinicInsert } : { insert: profileInsert },
      auth: { admin: { inviteUserByEmail } },
    } as never,
    logger: createLogger({}, () => undefined),
  };
  return { deps, clinicInsert, inviteUserByEmail, profileInsert };
}

describe(inviteClinic, () => {
  it('creates clinic, invites the user and links the profile', async () => {
    const { deps, inviteUserByEmail, profileInsert } = createDeps();
    const result = await inviteClinic(deps, invite);
    expect(result).toEqual({ status: 'ok', clinicId: 'clinic-1' });
    expect(inviteUserByEmail).toHaveBeenCalledWith(invite.contact_email);
    expect(profileInsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      role: 'clinic',
      clinic_id: 'clinic-1',
    });
  });

  it('reports invite_failed when the clinic exists but the email failed', async () => {
    const { deps } = createDeps({ inviteError: true });
    const result = await inviteClinic(deps, invite);
    expect(result).toEqual({ status: 'invite_failed', clinicId: 'clinic-1' });
  });

  it('reports an error when the clinic cannot be created', async () => {
    const { deps, inviteUserByEmail } = createDeps({ clinicError: true });
    const result = await inviteClinic(deps, invite);
    expect(result.status).toBe('error');
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('reports an error when the profile link fails', async () => {
    const { deps } = createDeps({ profileError: true });
    const result = await inviteClinic(deps, invite);
    expect(result.status).toBe('error');
  });
});
