import { describe, expect, it, vi } from 'vitest';

import { createAdminClientMock, testLogger, type QueryResult } from '@/lib/signup/test-utils';

import { approveSubmission, rejectSubmission } from './approve-submission';
import type { InviteDeps } from './invite-clinic';

const SUBMISSION_ID = '9f8b6c3a-0000-4000-8000-000000000010';
const CLINIC_ID = '9f8b6c3a-0000-4000-8000-000000000011';

const submissionRow = {
  name: 'Neue Law Clinic Bremen',
  contact_email: 'team@neue-clinic.de',
  website: 'https://neue-clinic.de',
  region: 'Bremen',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE, EN',
  description: null,
  requirements: null,
};

function createDeps(responses: QueryResult[]) {
  const mock = createAdminClientMock(responses);
  const deps: InviteDeps = { adminClient: mock.client as never, logger: testLogger() };
  return { deps, mock };
}

describe(approveSubmission, () => {
  it('inserts a published clinic, invites it, and clears the queue', async () => {
    const { deps, mock } = createDeps([
      { data: submissionRow, error: null },
      { data: { id: CLINIC_ID }, error: null },
      { data: null, error: null },
    ]);
    const invite = vi.fn().mockResolvedValue({ status: 'ok', clinicId: CLINIC_ID });
    const result = await approveSubmission(deps, SUBMISSION_ID, invite);
    expect(result).toEqual({ status: 'ok', clinicId: CLINIC_ID });
    expect(invite).toHaveBeenCalledWith(CLINIC_ID);
    expect(mock.calls).toContainEqual(['insert', [{ ...submissionRow, is_published: true }]]);
    expect(mock.calls).toContainEqual(['delete', []]);
  });

  it('surfaces invite_failed but still removes the submission', async () => {
    const { deps, mock } = createDeps([
      { data: submissionRow, error: null },
      { data: { id: CLINIC_ID }, error: null },
      { data: null, error: null },
    ]);
    const invite = vi.fn().mockResolvedValue({ status: 'invite_failed', clinicId: CLINIC_ID });
    const result = await approveSubmission(deps, SUBMISSION_ID, invite);
    expect(result).toEqual({ status: 'invite_failed', clinicId: CLINIC_ID });
    expect(mock.calls).toContainEqual(['delete', []]);
  });

  it('keeps the submission when the clinic insert fails', async () => {
    const { deps, mock } = createDeps([
      { data: submissionRow, error: null },
      { data: null, error: { message: 'duplicate key' } },
    ]);
    const invite = vi.fn();
    const result = await approveSubmission(deps, SUBMISSION_ID, invite);
    expect(result).toEqual({ status: 'error', reason: 'clinic insert failed' });
    expect(invite).not.toHaveBeenCalled();
    expect(mock.calls).not.toContainEqual(['delete', []]);
  });

  it('returns not_found for unknown submissions', async () => {
    const { deps } = createDeps([{ data: null, error: null }]);
    expect(await approveSubmission(deps, SUBMISSION_ID, vi.fn())).toEqual({ status: 'not_found' });
  });
});

describe(rejectSubmission, () => {
  it('deletes the submission', async () => {
    const { deps, mock } = createDeps([{ data: null, error: null }]);
    expect(await rejectSubmission(deps, SUBMISSION_ID)).toBe(true);
    expect(mock.calls).toContainEqual(['from', ['clinic_submissions']]);
    expect(mock.calls).toContainEqual(['eq', ['id', SUBMISSION_ID]]);
  });

  it('reports and logs a failed delete', async () => {
    const { deps } = createDeps([{ data: null, error: { message: 'boom' } }]);
    expect(await rejectSubmission(deps, SUBMISSION_ID)).toBe(false);
    expect(deps.logger.warn).toHaveBeenCalled();
  });
});
