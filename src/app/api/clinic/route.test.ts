import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireActiveRole = vi.hoisted(() => vi.fn());
const saveMemberClinic = vi.hoisted(() => vi.fn());
const sendClinicSubmissionNotice = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/require-role', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth/require-role')>('@/lib/auth/require-role');
  return { ...actual, requireActiveRole };
});
vi.mock('@/lib/firebase/clinic-repository', () => ({
  saveMemberClinic,
  ClinicNameConflictError: class extends Error {},
}));
vi.mock('@/lib/mail/clinic-notifications', () => ({ sendClinicSubmissionNotice }));

import { PATCH } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

const BODY = {
  name: 'Law and Lake',
  website: 'https://law-and-lake.example',
  contact_email: 'clinic@example.org',
  region: 'Konstanz',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'DE',
  description: 'Beratung',
  requirements: null,
  advises_clients: true,
};

function request(): Request {
  return new Request('http://localhost:3000/api/clinic', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
    body: JSON.stringify(BODY),
  });
}

describe('PATCH /api/clinic', () => {
  beforeEach(() => {
    requireActiveRole.mockReset().mockResolvedValue({ role: 'clinic', clinic_id: CLINIC_ID });
    saveMemberClinic.mockReset().mockResolvedValue({ notifySubmission: false });
    sendClinicSubmissionNotice.mockReset().mockResolvedValue(undefined);
  });

  it('tells the admin about the first submission of an unpublished entry', async () => {
    saveMemberClinic.mockResolvedValue({ notifySubmission: true });

    const response = await PATCH(request() as never);

    expect(response.status).toBe(200);
    expect(sendClinicSubmissionNotice).toHaveBeenCalledWith(CLINIC_ID, expect.anything());
  });

  it('stays silent on a save that claimed no notice', async () => {
    await PATCH(request() as never);

    expect(sendClinicSubmissionNotice).not.toHaveBeenCalled();
  });

  it('never lets a clinic write to another clinic id', async () => {
    requireActiveRole.mockResolvedValue({ role: 'clinic', clinic_id: null });

    const response = await PATCH(request() as never);

    expect(response.status).toBe(403);
    expect(saveMemberClinic).not.toHaveBeenCalled();
  });
});
