import { describe, expect, it } from 'vitest';

import type { ClinicDocument, ProfileDocument } from './documents';
import { firstAccessUpdates } from './activate-access';

const now = new Date('2026-08-16T10:00:00.000Z');
const profile: ProfileDocument = {
  role: 'clinic',
  clinicId: '11111111-1111-4111-8111-111111111111',
  accessStatus: 'active',
  activatedAt: null,
  createdAt: now,
  updatedAt: now,
};

const clinic: ClinicDocument = {
  name: 'Clinic',
  description: 'Beratung',
  region: 'Köln',
  website: 'https://example.org',
  legalAreas: 'Mietrecht',
  targetClients: 'Studierende',
  languages: 'Deutsch',
  requirements: null,
  advisesClients: true,
  isPublished: false,
  approvalStatus: 'approved',
  createdAt: now,
  updatedAt: now,
};

describe(firstAccessUpdates, () => {
  it('activates and publishes a complete approved clinic exactly once', () => {
    expect(firstAccessUpdates(profile, clinic, now)).toEqual({
      profile: { activatedAt: now, updatedAt: now },
      clinic: { isPublished: true, updatedAt: now },
    });
  });

  it('activates but leaves an incomplete clinic unpublished', () => {
    const incomplete = { ...clinic, languages: null };
    expect(firstAccessUpdates(profile, incomplete, now)?.clinic).toBeUndefined();
  });

  it('does nothing after first activation', () => {
    expect(firstAccessUpdates({ ...profile, activatedAt: now }, clinic, now)).toBeNull();
  });

  it('does nothing while access awaits approval', () => {
    expect(firstAccessUpdates({ ...profile, accessStatus: 'pending' }, clinic, now)).toBeNull();
  });
});
