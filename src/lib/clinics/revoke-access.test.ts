import { describe, expect, it, vi } from 'vitest';

import { revokeClinicAccess } from './revoke-access';

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function createAdminMock({
  profile,
  deleteError = null,
  updateError = null,
}: {
  profile: { user_id: string } | null;
  deleteError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const deleteUser = vi.fn().mockResolvedValue({ error: deleteError });
  const updates: unknown[] = [];
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    update: (payload: unknown) => (updates.push(payload), query),
    maybeSingle: () => Promise.resolve({ data: profile }),
  };
  // Awaiting the update chain (…update().eq()) resolves here.
  (query as { then: unknown }).then = (resolve: (value: unknown) => void) =>
    resolve({ error: updateError });
  const client = { from: () => query, auth: { admin: { deleteUser } } };
  return { client, deleteUser, updates };
}

describe(revokeClinicAccess, () => {
  it('deletes the linked auth user and leaves the entry published for an admin revoke', async () => {
    const { client, deleteUser, updates } = createAdminMock({ profile: { user_id: USER_ID } });
    await revokeClinicAccess(client as never, CLINIC_ID, {
      unpublish: false,
      clearContactEmail: false,
    });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(updates).toEqual([]);
  });

  it('clears the contact email when an admin resets access', async () => {
    const { client, updates } = createAdminMock({ profile: null });
    await revokeClinicAccess(client as never, CLINIC_ID, {
      unpublish: false,
      clearContactEmail: true,
    });
    expect(updates).toEqual([{ contact_email: null }]);
  });

  it('also unpublishes the entry when the clinic deletes itself', async () => {
    const { client, deleteUser, updates } = createAdminMock({ profile: { user_id: USER_ID } });
    await revokeClinicAccess(client as never, CLINIC_ID, {
      unpublish: true,
      clearContactEmail: false,
    });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(updates).toEqual([{ is_published: false }]);
  });

  it('still unpublishes when no login exists yet', async () => {
    const { client, deleteUser, updates } = createAdminMock({ profile: null });
    await revokeClinicAccess(client as never, CLINIC_ID, {
      unpublish: true,
      clearContactEmail: false,
    });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updates).toEqual([{ is_published: false }]);
  });

  it('throws without unpublishing when deleting the auth user fails', async () => {
    const { client, updates } = createAdminMock({
      profile: { user_id: USER_ID },
      deleteError: { message: 'auth down' },
    });
    await expect(
      revokeClinicAccess(client as never, CLINIC_ID, {
        unpublish: true,
        clearContactEmail: false,
      }),
    ).rejects.toThrow('auth down');
    expect(updates).toEqual([]);
  });
});
