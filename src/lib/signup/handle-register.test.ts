import { describe, expect, it, vi } from 'vitest';

import { clinicSubmissionSchema } from '@/lib/clinics/schema';

import { registerClinic, type RegisterDeps } from './handle-register';
import { testLogger } from './test-utils';

const submission = clinicSubmissionSchema.parse({
  name: 'Neue Law Clinic',
  contact_email: 'kontakt@example.org',
  website: 'https://example.org',
  region: 'Köln',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  advises_clients: true,
  description: null,
  requirements: null,
});

function dependencies(): RegisterDeps {
  return {
    store: {
      findByName: vi.fn().mockResolvedValue(null),
      isEmailTaken: vi.fn().mockResolvedValue(false),
      createPending: vi.fn().mockResolvedValue('clinic-1'),
      deletePending: vi.fn().mockResolvedValue(undefined),
    },
    claimWithEmail: vi.fn().mockResolvedValue({ status: 'ok', clinicId: 'clinic-1' }),
    logger: testLogger(),
  };
}

describe(registerClinic, () => {
  it('returns the existing masked clinic on a name collision', async () => {
    const deps = dependencies();
    const collision = {
      id: 'clinic-2',
      name: submission.name,
      region: 'Köln',
      claimed: false,
      hasContactEmail: false,
      maskedEmail: null,
    };
    vi.mocked(deps.store.findByName).mockResolvedValue(collision);
    expect(await registerClinic(deps, submission)).toEqual({
      status: 'collision',
      clinic: collision,
    });
  });

  it('rejects an e-mail already reserved by another identity', async () => {
    const deps = dependencies();
    vi.mocked(deps.store.isEmailTaken).mockResolvedValue(true);
    expect(await registerClinic(deps, submission)).toEqual({ status: 'email_taken' });
  });

  it('creates a pending clinic and claimant identity', async () => {
    const deps = dependencies();
    expect(await registerClinic(deps, submission)).toEqual({
      status: 'pending_review',
      email: submission.contact_email,
    });
    expect(deps.claimWithEmail).toHaveBeenCalledWith('clinic-1', submission.contact_email);
  });

  it('removes an unreachable pending row after invitation failure', async () => {
    const deps = dependencies();
    vi.mocked(deps.claimWithEmail).mockResolvedValue({
      status: 'invite_failed',
      clinicId: 'clinic-1',
    });
    expect(await registerClinic(deps, submission)).toEqual({ status: 'error' });
    expect(deps.store.deletePending).toHaveBeenCalledWith('clinic-1');
  });
});
