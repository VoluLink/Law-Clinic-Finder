import { describe, expect, it, vi } from 'vitest';

import { revokeClinicAccess } from './revoke-access';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

describe(revokeClinicAccess, () => {
  it('delegates the exact retained-directory options to the access store', async () => {
    const store = { revoke: vi.fn().mockResolvedValue(undefined) };
    const options = { unpublish: true, clearContactEmail: false };
    await revokeClinicAccess(store, CLINIC_ID, options);
    expect(store.revoke).toHaveBeenCalledWith(CLINIC_ID, options);
  });

  it('propagates a failed auth deletion before reporting success', async () => {
    const store = { revoke: vi.fn().mockRejectedValue(new Error('auth down')) };
    await expect(
      revokeClinicAccess(store, CLINIC_ID, { unpublish: true, clearContactEmail: false }),
    ).rejects.toThrow('auth down');
  });
});
