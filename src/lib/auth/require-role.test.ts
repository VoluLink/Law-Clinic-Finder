import { describe, expect, it } from 'vitest';

import { AuthError, requireActiveRole, requireRole } from './require-role';

const activeClinic = {
  role: 'clinic',
  clinic_id: 'clinic-1',
  access_status: 'active',
};

function dependencies(sessionUserId: string | null, profiles = new Map<string, unknown>()) {
  return {
    readSession: async () => (sessionUserId ? { uid: sessionUserId } : null),
    readProfile: async (userId: string) => profiles.get(userId),
  };
}

describe(requireRole, () => {
  it('returns the caller profile when the role is allowed', async () => {
    const profiles = new Map([['user-1', activeClinic]]);
    await expect(requireRole(['clinic'], dependencies('user-1', profiles))).resolves.toEqual({
      ...activeClinic,
      user_id: 'user-1',
    });
  });

  it('loads only the session user profile', async () => {
    const profiles = new Map<string, unknown>([
      ['admin-1', { role: 'admin', clinic_id: null, access_status: 'active' }],
      ['clinic-9', activeClinic],
    ]);
    await expect(requireRole(['admin'], dependencies('admin-1', profiles))).resolves.toMatchObject({
      role: 'admin',
      user_id: 'admin-1',
    });
  });

  it('throws 401 when not signed in', async () => {
    await expect(requireRole(['clinic'], dependencies(null))).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    });
  });

  it('throws 403 when the role is not allowed', async () => {
    const profiles = new Map([['user-1', activeClinic]]);
    await expect(requireRole(['admin'], dependencies('user-1', profiles))).rejects.toMatchObject({
      status: 403,
    });
  });

  it('throws 403 when no valid profile exists', async () => {
    await expect(requireRole(['admin', 'clinic'], dependencies('user-1'))).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('returns pending profiles for the waiting-page decision', async () => {
    const profiles = new Map([['user-1', { ...activeClinic, access_status: 'pending' }]]);
    await expect(requireRole(['clinic'], dependencies('user-1', profiles))).resolves.toMatchObject({
      access_status: 'pending',
    });
  });
});

describe(requireActiveRole, () => {
  it('returns a clinic with active access', async () => {
    const profiles = new Map([['user-1', activeClinic]]);
    await expect(
      requireActiveRole(['clinic'], dependencies('user-1', profiles)),
    ).resolves.toMatchObject({ clinic_id: 'clinic-1' });
  });

  it('throws 403 while a claim awaits approval', async () => {
    const profiles = new Map([['user-1', { ...activeClinic, access_status: 'pending' }]]);
    await expect(
      requireActiveRole(['clinic'], dependencies('user-1', profiles)),
    ).rejects.toMatchObject({ name: 'AuthError', status: 403 });
  });
});
