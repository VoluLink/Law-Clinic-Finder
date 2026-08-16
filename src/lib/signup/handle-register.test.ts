import { describe, expect, it, vi } from 'vitest';

import { clinicSubmissionSchema } from '@/lib/clinics/schema';

import { registerClinic, type RegisterDeps } from './handle-register';
import { createAdminClientMock, testLogger, type QueryResult } from './test-utils';

const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000003';

const submission = clinicSubmissionSchema.parse({
  name: 'Neue Law Clinic Bremen',
  contact_email: 'team@neue-clinic.de',
  website: 'https://neue-clinic.de',
  region: 'Bremen',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE, EN',
  advises_clients: true,
  description: null,
  requirements: null,
});

function createDeps(responses: QueryResult[], overrides?: Partial<RegisterDeps>) {
  const mock = createAdminClientMock(responses);
  const deps: RegisterDeps = {
    adminClient: mock.client as never,
    logger: testLogger(),
    claimWithEmail: vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID }),
    isEmailTaken: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  return { deps, mock };
}

describe('clinicSubmissionSchema', () => {
  it('requires the homepage', () => {
    expect(clinicSubmissionSchema.safeParse({ ...submission, website: '' }).success).toBe(false);
  });

  it('requires a valid contact email', () => {
    const invalid = { ...submission, contact_email: 'nope' };
    expect(clinicSubmissionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe(registerClinic, () => {
  it('creates the entry unapproved and awaits review', async () => {
    const { deps } = createDeps([
      { data: null, error: null },
      { data: { id: CLINIC_ID }, error: null },
    ]);
    expect(await registerClinic(deps, submission)).toEqual({
      status: 'pending_review',
      email: submission.contact_email,
    });
  });

  it('never publishes the new entry', async () => {
    const { deps, mock } = createDeps([
      { data: null, error: null },
      { data: { id: CLINIC_ID }, error: null },
    ]);
    await registerClinic(deps, submission);
    expect(mock.calls).toContainEqual([
      'insert',
      [{ ...submission, approval_status: 'pending', is_published: false }],
    ]);
  });

  it('links the login to the new entry', async () => {
    const { deps } = createDeps([
      { data: null, error: null },
      { data: { id: CLINIC_ID }, error: null },
    ]);
    await registerClinic(deps, submission);
    expect(deps.claimWithEmail).toHaveBeenCalledWith(CLINIC_ID, submission.contact_email);
  });

  it('redirects name collisions into the claim flow instead of duplicating', async () => {
    const existing = {
      id: '9f8b6c3a-0000-4000-8000-000000000002',
      name: 'Neue Law Clinic Bremen',
      region: 'Bremen',
      contact_email: 'alt@neue-clinic.de',
      profiles: [],
    };
    const { deps } = createDeps([{ data: existing, error: null }]);
    const result = await registerClinic(deps, submission);
    expect(result).toMatchObject({
      status: 'collision',
      clinic: { id: existing.id, maskedEmail: 'a****t@neue-clinic.de' },
    });
    expect(deps.claimWithEmail).not.toHaveBeenCalled();
  });

  it('checks the name case-insensitively but exactly', async () => {
    const { deps, mock } = createDeps([
      { data: null, error: null },
      { data: { id: CLINIC_ID }, error: null },
    ]);
    await registerClinic(deps, submission);
    expect(mock.calls).toContainEqual(['ilike', ['name', 'Neue Law Clinic Bremen']]);
  });

  it('refuses an address that already belongs to another account', async () => {
    const { deps } = createDeps([{ data: null, error: null }], {
      isEmailTaken: vi.fn().mockResolvedValue(true),
    });
    expect(await registerClinic(deps, submission)).toEqual({ status: 'email_taken' });
  });

  it('reports an error when the insert fails', async () => {
    const { deps } = createDeps([
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    ]);
    expect(await registerClinic(deps, submission)).toEqual({ status: 'error' });
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it('removes the entry again when the invite fails, so the queue stays clean', async () => {
    const { deps, mock } = createDeps(
      [
        { data: null, error: null },
        { data: { id: CLINIC_ID }, error: null },
        { data: null, error: null },
      ],
      {
        claimWithEmail: vi.fn().mockResolvedValue({ status: 'invite_failed', clinicId: CLINIC_ID }),
      },
    );
    expect(await registerClinic(deps, submission)).toEqual({ status: 'error' });
    expect(mock.calls).toContainEqual(['delete', []]);
  });
});
