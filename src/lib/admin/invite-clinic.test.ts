import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@/lib/logger';

import { inviteClinic, reinviteClinic, type InviteDeps } from './invite-clinic';

const invite = { name: 'Neue Clinic', contact_email: 'org@example.org' };

function dependencies(): InviteDeps {
  return {
    store: {
      createClinic: vi.fn().mockResolvedValue('clinic-1'),
      readInviteState: vi.fn().mockResolvedValue({ email: invite.contact_email, userId: 'user-1' }),
      createAndLinkUser: vi.fn().mockResolvedValue('ok'),
      resendInvite: vi.fn().mockResolvedValue('ok'),
    },
    logger: createLogger({}, () => undefined),
  };
}

describe(inviteClinic, () => {
  it('creates an approved clinic then links and invites its user', async () => {
    const deps = dependencies();
    expect(await inviteClinic(deps, invite)).toEqual({ status: 'ok', clinicId: 'clinic-1' });
    expect(deps.store.createClinic).toHaveBeenCalledWith(invite);
    expect(deps.store.createAndLinkUser).toHaveBeenCalledWith(
      'clinic-1',
      invite.contact_email,
      'active',
    );
  });

  it('keeps the clinic when e-mail delivery fails', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.createAndLinkUser).mockResolvedValue('invite_failed');
    expect(await inviteClinic(deps, invite)).toEqual({
      status: 'invite_failed',
      clinicId: 'clinic-1',
    });
  });

  it('reports a clinic-name conflict without creating an Auth user', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.createClinic).mockRejectedValue(new Error('duplicate'));
    expect((await inviteClinic(deps, invite)).status).toBe('error');
    expect(deps.store.createAndLinkUser).not.toHaveBeenCalled();
  });
});

describe(reinviteClinic, () => {
  it('sends a new link to an existing unactivated account', async () => {
    const deps = dependencies();
    expect(await reinviteClinic(deps, 'clinic-1')).toEqual({ status: 'ok', clinicId: 'clinic-1' });
    expect(deps.store.resendInvite).toHaveBeenCalledWith(
      'clinic-1',
      'user-1',
      invite.contact_email,
    );
  });

  it('creates the Auth identity when the first invite failed before linking', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.readInviteState).mockResolvedValue({
      email: invite.contact_email,
      userId: null,
    });
    await reinviteClinic(deps, 'clinic-1');
    expect(deps.store.createAndLinkUser).toHaveBeenCalledOnce();
  });
});
