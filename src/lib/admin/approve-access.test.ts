import { describe, expect, it, vi } from 'vitest';

import { testLogger } from '@/lib/signup/test-utils';

import { approveAccess, rejectAccess, type AccessReviewDeps } from './approve-access';

const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000004';
const completeClinic = {
  id: CLINIC_ID,
  approval_status: 'pending' as const,
  name: 'Neue Law Clinic Bremen',
  website: 'https://neue-clinic.de',
  region: 'Bremen',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE',
  advises_clients: true,
  description: null,
};

type TestClinic = Omit<typeof completeClinic, 'website' | 'approval_status'> & {
  website: string | null;
  approval_status: 'pending' | 'approved';
};

function dependencies(clinic: TestClinic | null = completeClinic): AccessReviewDeps {
  return {
    reviewStore: {
      readClinic: vi.fn().mockResolvedValue(clinic),
      hasVerifiedIdentity: vi.fn().mockResolvedValue(true),
      approve: vi.fn().mockResolvedValue({ notifyPublication: false }),
      deleteSelfRegistered: vi.fn().mockResolvedValue(undefined),
    },
    accessStore: { revoke: vi.fn().mockResolvedValue(undefined) },
    logger: testLogger(),
    notifyPublication: vi.fn().mockResolvedValue(undefined),
  };
}

describe(approveAccess, () => {
  /*
   * A claimant is created with emailVerified: false and only becomes verified by
   * following the emailed link. Approving before that activates an account bound
   * to an address nobody proved they control — which is exactly how someone
   * squats a clinic they have no connection to, using a stranger's address.
   */
  describe('proof of address control', () => {
    it('refuses to activate an identity that never answered the invitation', async () => {
      const deps = dependencies();
      deps.reviewStore.hasVerifiedIdentity = vi.fn().mockResolvedValue(false);

      expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'unverified' });
      expect(deps.reviewStore.approve).not.toHaveBeenCalled();
    });

    it('records the refusal without naming the address', async () => {
      const deps = dependencies();
      deps.reviewStore.hasVerifiedIdentity = vi.fn().mockResolvedValue(false);

      await approveAccess(deps, CLINIC_ID);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('approval'),
        expect.objectContaining({ clinicId: CLINIC_ID }),
      );
    });

    it('treats a missing identity as unverified rather than approving it', async () => {
      const deps = dependencies();
      deps.reviewStore.hasVerifiedIdentity = vi.fn().mockResolvedValue(false);

      expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'unverified' });
    });

    it('still approves a claimant who followed the link', async () => {
      const deps = dependencies();

      expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
      expect(deps.reviewStore.approve).toHaveBeenCalledWith(CLINIC_ID, true);
    });
  });

  it('publishes a complete approved entry', async () => {
    const deps = dependencies();
    expect(await approveAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
    expect(deps.reviewStore.approve).toHaveBeenCalledWith(CLINIC_ID, true);
  });

  it('tells the clinic once when the approval published its entry', async () => {
    const deps = dependencies();
    deps.reviewStore.approve = vi.fn().mockResolvedValue({ notifyPublication: true });

    await approveAccess(deps, CLINIC_ID);

    expect(deps.notifyPublication).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('stays silent when the approval claimed no notice', async () => {
    const deps = dependencies();

    await approveAccess(deps, CLINIC_ID);

    expect(deps.notifyPublication).not.toHaveBeenCalled();
  });

  it('approves an incomplete entry without publishing it', async () => {
    const deps = dependencies({ ...completeClinic, website: null });
    await approveAccess(deps, CLINIC_ID);
    expect(deps.reviewStore.approve).toHaveBeenCalledWith(CLINIC_ID, false);
  });

  it('reports an unknown clinic', async () => {
    expect(await approveAccess(dependencies(null), CLINIC_ID)).toEqual({ status: 'not_found' });
  });
});

describe(rejectAccess, () => {
  it('deletes a self-registered entry', async () => {
    const deps = dependencies();
    expect(await rejectAccess(deps, CLINIC_ID)).toEqual({ status: 'ok' });
    expect(deps.reviewStore.deleteSelfRegistered).toHaveBeenCalledWith(CLINIC_ID);
  });

  it('keeps an admin-created entry while revoking its access', async () => {
    const deps = dependencies({ ...completeClinic, approval_status: 'approved' });
    await rejectAccess(deps, CLINIC_ID);
    expect(deps.accessStore.revoke).toHaveBeenCalledWith(CLINIC_ID, {
      unpublish: false,
      clearContactEmail: true,
    });
  });
});
