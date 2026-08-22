import { describe, expect, it } from 'vitest';

import { prepareCorePhase, prepareIdentityPhase, retainedTranscriptIds } from './prepare';
import { transformClinic, transformConversation } from './transforms';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const DEV_ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const DEV_CLINIC_ID = '55555555-5555-4555-8555-555555555555';

describe(prepareCorePhase, () => {
  it('writes private contacts separately and reserves clinic names', () => {
    const clinic = transformClinic({
      id: CLINIC_ID,
      name: 'Law Clinic',
      description: null,
      region: null,
      contact_email: 'clinic@example.org',
      website: null,
      legal_areas: '',
      target_clients: null,
      languages: null,
      requirements: null,
      advises_clients: true,
      is_published: false,
      approval_status: 'approved',
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: '2026-08-01T10:00:00.000Z',
    });
    const phase = prepareCorePhase([clinic]);
    expect(phase.documents.map((document) => document.path)).toEqual([
      `clinicContacts/${CLINIC_ID}`,
      `clinics/${CLINIC_ID}`,
      expect.stringMatching(/^uniqueClinicNames\/[0-9a-f]{64}$/),
    ]);
  });
});

describe(prepareIdentityPhase, () => {
  it('preserves UIDs and builds server-side ownership reservations', () => {
    const result = prepareIdentityPhase(
      [
        {
          id: USER_ID,
          email: 'Owner@Example.org',
          created_at: '2026-08-01T10:00:00.000Z',
          email_confirmed_at: '2026-08-01T10:00:00.000Z',
        },
        {
          id: ADMIN_ID,
          email: 'admin@example.org',
          created_at: '2026-08-01T10:00:00.000Z',
          email_confirmed_at: '2026-08-01T10:00:00.000Z',
        },
      ],
      [
        {
          user_id: USER_ID,
          role: 'clinic',
          clinic_id: CLINIC_ID,
          access_status: 'active',
          activated_at: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
        {
          user_id: ADMIN_ID,
          role: 'admin',
          clinic_id: null,
          access_status: 'active',
          activated_at: null,
          created_at: '2026-08-01T10:00:00.000Z',
        },
      ],
      new Set([CLINIC_ID]),
    );
    expect(result.authUsers[0]).toMatchObject({
      uid: USER_ID,
      email: 'owner@example.org',
      customClaims: { role: 'clinic', clinicId: CLINIC_ID, accessStatus: 'active' },
    });
    expect(result.phase.documents.map((document) => document.path)).toContain(
      `uniqueClinicOwners/${CLINIC_ID}`,
    );
  });

  it('excludes the two reserved development identities and their profiles', () => {
    const result = prepareIdentityPhase(
      [
        authUser(ADMIN_ID, 'owner@example.org'),
        authUser(DEV_ADMIN_ID, 'admin@example.com'),
        authUser(DEV_CLINIC_ID, 'startright@example.com'),
      ],
      [adminProfile(ADMIN_ID), adminProfile(DEV_ADMIN_ID), clinicProfile(DEV_CLINIC_ID)],
      new Set([CLINIC_ID]),
    );
    expect(result.authUsers.map((user) => user.uid)).toEqual([ADMIN_ID]);
    expect(result.phase.documents.map((document) => document.path)).not.toEqual(
      expect.arrayContaining([`profiles/${DEV_ADMIN_ID}`, `profiles/${DEV_CLINIC_ID}`]),
    );
  });
});

function authUser(id: string, email: string) {
  return {
    id,
    email,
    created_at: '2026-08-01T10:00:00.000Z',
    email_confirmed_at: '2026-08-01T10:00:00.000Z',
  };
}

function adminProfile(userId: string) {
  return {
    user_id: userId,
    role: 'admin',
    clinic_id: null,
    access_status: 'active',
    activated_at: null,
    created_at: '2026-08-01T10:00:00.000Z',
  };
}

function clinicProfile(userId: string) {
  return {
    ...adminProfile(userId),
    role: 'clinic',
    clinic_id: CLINIC_ID,
  };
}

describe(retainedTranscriptIds, () => {
  it('keeps only the newest 200 transcripts', () => {
    const conversations = Array.from({ length: 201 }, (_, index) =>
      transformConversation(
        {
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          session_id: null,
          created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
          redacted_transcript: [{ role: 'user', content: 'Frage' }],
          redaction_status: 'ok',
          detected_legal_area: null,
          detected_city: null,
          matched_clinic_count: 0,
          message_count: 1,
          model: 'model',
          input_tokens: 1,
          output_tokens: 1,
        },
        [],
      ),
    );
    const retained = retainedTranscriptIds(conversations);
    expect(retained).toHaveLength(200);
    expect(retained).not.toContain(conversations[0].id);
  });
});
