import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';

import {
  clinicContactDocumentSchema,
  clinicDocumentSchema,
  profileDocumentSchema,
} from './documents';

const now = Timestamp.fromDate(new Date('2026-08-16T10:00:00.000Z'));

const clinic = {
  name: 'Law Clinic Köln',
  description: 'Beratung',
  region: 'Köln',
  website: 'https://example.org',
  legalAreas: 'Mietrecht',
  targetClients: 'Studierende',
  languages: 'Deutsch',
  requirements: null,
  advisesClients: true,
  isPublished: true,
  approvalStatus: 'approved',
  createdAt: now,
  updatedAt: now,
};

describe('clinicDocumentSchema', () => {
  it('parses Firestore timestamps into dates', () => {
    expect(clinicDocumentSchema.parse(clinic).createdAt).toEqual(now.toDate());
  });

  it('does not permit private contact e-mail fields', () => {
    expect(
      clinicDocumentSchema.safeParse({ ...clinic, contactEmail: 'secret@example.org' }).success,
    ).toBe(false);
  });

  it('rejects a published clinic awaiting approval', () => {
    expect(clinicDocumentSchema.safeParse({ ...clinic, approvalStatus: 'pending' }).success).toBe(
      false,
    );
  });
});

describe('clinicContactDocumentSchema', () => {
  it('normalizes the private contact e-mail', () => {
    expect(clinicContactDocumentSchema.parse({ contactEmail: ' INFO@Example.org ' })).toEqual({
      contactEmail: 'info@example.org',
    });
  });
});

describe('profileDocumentSchema', () => {
  it('requires clinic users to reference a clinic', () => {
    const profile = {
      role: 'clinic',
      clinicId: null,
      accessStatus: 'active',
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(profileDocumentSchema.safeParse(profile).success).toBe(false);
  });
});
