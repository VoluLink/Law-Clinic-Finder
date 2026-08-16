import { describe, expect, it, vi } from 'vitest';

import { createAdminClientMock, testLogger, type QueryResult } from '@/lib/signup/test-utils';

import { approveAccess, rejectAccess } from './approve-access';
import type { InviteDeps } from './invite-clinic';

const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000004';

const completeClinic = {
  id: CLINIC_ID,
  approval_status: 'pending',
  name: 'Neue Law Clinic Bremen',
  website: 'https://neue-clinic.de',
  region: 'Bremen',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE',
  advises_clients: true,
  description: null,
};

function createDeps(responses: QueryResult[], deleteUser = vi.fn().mockResolvedValue({})) {
  const mock = createAdminClientMock(responses);
  const deps: InviteDeps = {
    adminClient: { ...mock.client, auth: { admin: { deleteUser } } } as never,
    logger: testLogger(),
  };
  return { deps, mock, deleteUser };
}

const ok: QueryResult = { data: null, error: null };

describe(approveAccess, () => {
  it('approves the entry and publishes it when it is complete', async () => {
    const { deps, mock } = createDeps([{ data: completeClinic, error: null }, ok, ok]);
    expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
    expect(mock.calls).toContainEqual([
      'update',
      [{ approval_status: 'approved', is_published: true }],
    ]);
  });

  it('approves without publishing when required fields are missing', async () => {
    const incomplete = { ...completeClinic, website: null };
    const { deps, mock } = createDeps([{ data: incomplete, error: null }, ok, ok]);
    await approveAccess(deps, CLINIC_ID);
    expect(mock.calls).toContainEqual([
      'update',
      [{ approval_status: 'approved', is_published: false }],
    ]);
  });

  it('activates the pending login', async () => {
    const { deps, mock } = createDeps([{ data: completeClinic, error: null }, ok, ok]);
    await approveAccess(deps, CLINIC_ID);
    expect(mock.calls).toContainEqual(['update', [{ access_status: 'active' }]]);
  });

  it('reports an unknown clinic', async () => {
    const { deps } = createDeps([ok]);
    expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'not_found' });
  });

  it('reports an error when the clinic update fails', async () => {
    const { deps } = createDeps([
      { data: completeClinic, error: null },
      { data: null, error: { message: 'boom' } },
    ]);
    expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'error' });
  });
});

describe(rejectAccess, () => {
  it('deletes a self-registered entry along with its login', async () => {
    const { deps, mock } = createDeps([{ data: { ...completeClinic }, error: null }, ok]);
    expect(await rejectAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
    expect(mock.calls).toContainEqual(['delete', []]);
  });

  it('keeps an admin-created entry but drops the address the claimant supplied', async () => {
    const approved = { ...completeClinic, approval_status: 'approved' };
    const { deps, mock, deleteUser } = createDeps([
      { data: approved, error: null },
      { data: { user_id: 'user-1' }, error: null },
      ok,
    ]);
    expect(await rejectAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
    expect(deleteUser).toHaveBeenCalledWith('user-1');
    expect(mock.calls).toContainEqual(['update', [{ contact_email: null }]]);
    expect(mock.calls).not.toContainEqual(['delete', []]);
  });

  it('reports an unknown clinic', async () => {
    const { deps } = createDeps([ok]);
    expect(await rejectAccess(deps, CLINIC_ID)).toEqual({ status: 'not_found' });
  });
});
