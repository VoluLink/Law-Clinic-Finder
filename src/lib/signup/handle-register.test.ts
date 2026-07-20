import { describe, expect, it } from 'vitest';

import { clinicSubmissionSchema } from '@/lib/clinics/schema';

import { registerClinic } from './handle-register';
import type { SignupDeps } from './handle-search';
import { createAdminClientMock, testLogger, type QueryResult } from './test-utils';

const submission = clinicSubmissionSchema.parse({
  name: 'Neue Law Clinic Bremen',
  contact_email: 'team@neue-clinic.de',
  website: 'https://neue-clinic.de',
  region: 'Bremen',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE, EN',
  description: null,
  requirements: null,
});

function createDeps(responses: QueryResult[]) {
  const mock = createAdminClientMock(responses);
  const deps: SignupDeps = { adminClient: mock.client as never, logger: testLogger() };
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
  it('stores the submission in the approval queue', async () => {
    const { deps, mock } = createDeps([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    expect(await registerClinic(deps, submission)).toEqual({ status: 'submitted' });
    expect(mock.calls).toContainEqual(['from', ['clinic_submissions']]);
    expect(mock.calls).toContainEqual(['insert', [submission]]);
  });

  it('redirects name collisions into the claim flow instead of duplicating', async () => {
    const existing = {
      id: '9f8b6c3a-0000-4000-8000-000000000002',
      name: 'Neue Law Clinic Bremen',
      region: 'Bremen',
      contact_email: 'alt@neue-clinic.de',
      profiles: [],
    };
    const { deps, mock } = createDeps([{ data: existing, error: null }]);
    const result = await registerClinic(deps, submission);
    expect(result).toMatchObject({
      status: 'collision',
      clinic: { id: existing.id, maskedEmail: 'a****t@neue-clinic.de' },
    });
    expect(mock.calls).not.toContainEqual(['from', ['clinic_submissions']]);
  });

  it('checks the name case-insensitively but exactly', async () => {
    const { deps, mock } = createDeps([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    await registerClinic(deps, submission);
    expect(mock.calls).toContainEqual(['ilike', ['name', 'Neue Law Clinic Bremen']]);
  });

  it('reports an error when the insert fails', async () => {
    const { deps } = createDeps([
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    ]);
    expect(await registerClinic(deps, submission)).toEqual({ status: 'error' });
    expect(deps.logger.warn).toHaveBeenCalled();
  });
});
