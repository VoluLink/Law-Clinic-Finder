import { describe, expect, it } from 'vitest';

import {
  buildAdminMetrics,
  buildClaimLimits,
  buildClinicMetrics,
  checksumRecords,
  transformClinic,
  transformConversation,
  transformSettings,
  transformProfile,
} from './transforms';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'firebase_uid-1';
const SOURCE_CLINIC = {
  id: CLINIC_ID,
  name: 'Law Clinic',
  description: null,
  region: 'Köln',
  contact_email: 'Kontakt@Example.org',
  website: 'https://example.org',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  requirements: null,
  advises_clients: true,
  is_published: true,
  approval_status: 'approved',
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-02T10:00:00.000Z',
} as const;

describe(transformClinic, () => {
  it('separates private contact data from the public clinic document', () => {
    const result = transformClinic(SOURCE_CLINIC);
    expect(result.clinic).not.toHaveProperty('contactEmail');
    expect(result.contact).toEqual({ contactEmail: 'kontakt@example.org' });
    expect(result.clinic).toMatchObject({ legalAreas: 'Mietrecht', isPublished: true });
  });

  it('rejects executable source website schemes', () => {
    expect(() => transformClinic({ ...SOURCE_CLINIC, website: 'javascript:alert(1)' })).toThrow();
  });
});

describe(transformProfile, () => {
  it('preserves the source UID and canonical role claims', () => {
    const result = transformProfile({
      user_id: USER_ID,
      role: 'clinic',
      clinic_id: CLINIC_ID,
      access_status: 'active',
      activated_at: null,
      created_at: '2026-08-01T10:00:00.000Z',
    });
    expect(result.id).toBe(USER_ID);
    expect(result.claims).toEqual({
      role: 'clinic',
      clinicId: CLINIC_ID,
      accessStatus: 'active',
    });
  });
});

describe(transformConversation, () => {
  it('preserves retained transcripts and builds per-model usage', () => {
    const result = transformConversation(
      {
        id: '22222222-2222-4222-8222-222222222222',
        session_id: null,
        created_at: '2026-08-01T10:00:00.000Z',
        redacted_transcript: [{ role: 'user', content: 'Frage' }],
        redaction_status: 'ok',
        detected_legal_area: 'Mietrecht',
        detected_city: 'Köln',
        matched_clinic_count: 1,
        message_count: 1,
        model: 'claude-haiku-4-5-20251001',
        input_tokens: 100,
        output_tokens: 20,
      },
      [CLINIC_ID],
    );
    expect(result.summary).toMatchObject({
      hasTranscript: true,
      recommendedClinicIds: [CLINIC_ID],
      modelUsage: {
        'claude-haiku-4-5-20251001': { inputTokens: 100, outputTokens: 20 },
      },
    });
    expect(result.transcript?.messages).toHaveLength(1);
  });
});

describe(checksumRecords, () => {
  it('is deterministic regardless of source page ordering', () => {
    const first = [
      { id: 'b', count: 2 },
      { id: 'a', count: 1 },
    ];
    expect(checksumRecords(first)).toBe(checksumRecords([...first].reverse()));
  });

  it('treats a Firestore timestamp like the corresponding source date', () => {
    const date = new Date('2026-08-01T10:00:00.000Z');
    expect(checksumRecords([{ createdAt: date }])).toBe(
      checksumRecords([{ createdAt: { toDate: () => date } }]),
    );
  });
});

describe('derived metric rebuilds', () => {
  it('rebuilds monthly admin and clinic counters from source records', () => {
    const conversation = transformConversation(
      {
        id: '22222222-2222-4222-8222-222222222222',
        session_id: null,
        created_at: '2026-08-01T10:00:00.000Z',
        redacted_transcript: null,
        redaction_status: 'failed',
        detected_legal_area: 'Mietrecht',
        detected_city: null,
        matched_clinic_count: 1,
        message_count: 1,
        model: 'claude-haiku-4-5-20251001',
        input_tokens: 100,
        output_tokens: 20,
      },
      [CLINIC_ID],
    );
    const admin = buildAdminMetrics([conversation]);
    expect(admin.get('2026-08')).toMatchObject({
      conversationCount: 1,
      matchedConversationCount: 1,
      dayBuckets: { '2026-08-01': 1 },
    });

    const clinic = buildClinicMetrics([
      {
        id: '33333333-3333-4333-8333-333333333333',
        clinic_id: CLINIC_ID,
        kind: 'recommended',
        conversation_id: conversation.id,
        created_at: '2026-08-01T10:00:00.000Z',
      },
    ]);
    expect(clinic.get(`${CLINIC_ID}/2026-08`)).toMatchObject({
      recommendedCount: 1,
      recommendationDays: { '2026-08-01': 1 },
    });
  });
});

describe(buildClaimLimits, () => {
  it('keeps only the latest two attempts inside the rolling window', () => {
    const now = new Date('2026-08-16T10:00:00.000Z');
    const limits = buildClaimLimits(
      [
        { clinic_id: CLINIC_ID, sent_at: '2026-08-01T10:00:00.000Z' },
        { clinic_id: CLINIC_ID, sent_at: '2026-08-14T10:00:00.000Z' },
        { clinic_id: CLINIC_ID, sent_at: '2026-08-15T10:00:00.000Z' },
      ],
      now,
    );
    expect(limits.get(CLINIC_ID)?.attempts).toHaveLength(2);
  });
});

describe(transformSettings, () => {
  it('fails closed when a required DB-only prompt setting is absent', () => {
    expect(() =>
      transformSettings([
        { key: 'chat_enabled', value: true, updated_at: '2026-08-01T10:00:00.000Z' },
      ]),
    ).toThrow(/missing/i);
  });
});
