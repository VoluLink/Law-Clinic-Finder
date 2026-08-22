import { describe, expect, it } from 'vitest';

import { prepareAdminClinicUpdate } from './admin-clinic-update';

const COMPLETE = {
  name: 'Clinic',
  website: 'https://example.org',
  contact_email: 'kontakt@example.org',
  region: 'Köln',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  requirements: null,
  description: null,
  advises_clients: true,
  is_published: false,
  approval_status: 'approved' as const,
};

describe(prepareAdminClinicUpdate, () => {
  it('allows a complete approved clinic to be published', () => {
    expect(prepareAdminClinicUpdate(COMPLETE, { is_published: true })).toMatchObject({
      allowed: true,
      clinic: { is_published: true },
    });
  });

  it('reports missing fields after merging the incoming edit', () => {
    const current = { ...COMPLETE, website: null };
    expect(prepareAdminClinicUpdate(current, { is_published: true })).toEqual({
      allowed: false,
      reason: 'incomplete',
      missing: ['website'],
    });
  });

  it('uses incoming values when checking publication completeness', () => {
    const current = { ...COMPLETE, website: null };
    expect(
      prepareAdminClinicUpdate(current, {
        website: 'https://new.example',
        is_published: true,
      }),
    ).toMatchObject({ allowed: true, clinic: { website: 'https://new.example' } });
  });

  it('does not allow a pending clinic to be published directly', () => {
    const pending = { ...COMPLETE, approval_status: 'pending' as const };
    expect(prepareAdminClinicUpdate(pending, { is_published: true })).toEqual({
      allowed: false,
      reason: 'unapproved',
    });
  });

  it('preserves publication when editing an already published row', () => {
    const published = { ...COMPLETE, is_published: true };
    expect(prepareAdminClinicUpdate(published, { region: 'Berlin' })).toMatchObject({
      allowed: true,
      clinic: { is_published: true, region: 'Berlin' },
    });
  });
});
