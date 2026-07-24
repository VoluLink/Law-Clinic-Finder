import { describe, expect, it } from 'vitest';

import {
  memberBlockers,
  missingRequiredKeys,
  MEMBER_KEYS,
  publishBlockers,
  toRequiredLabels,
} from './publish-requirements';

const COMPLETE = {
  name: 'Clinic',
  website: 'https://example.org',
  contact_email: 'kontakt@example.org',
  region: 'Köln',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  description: '',
  advises_clients: true,
};

describe('publishBlockers', () => {
  it('is empty when every publish-required field is filled', () => {
    expect(publishBlockers(COMPLETE)).toEqual([]);
  });

  it('does not require contact_email (always present on admin rows)', () => {
    expect(publishBlockers({ ...COMPLETE, contact_email: '' })).toEqual([]);
  });

  it('lists a missing required field by key', () => {
    expect(publishBlockers({ ...COMPLETE, website: null })).toEqual(['website']);
  });

  it('treats a whitespace-only value as missing', () => {
    expect(publishBlockers({ ...COMPLETE, region: '   ' })).toEqual(['region']);
  });

  it('requires the alternative text when the clinic does not advise clients', () => {
    expect(publishBlockers({ ...COMPLETE, advises_clients: false, description: '' })).toEqual([
      'description',
    ]);
  });

  it('accepts a non-advising clinic that explains its alternative', () => {
    expect(
      publishBlockers({ ...COMPLETE, advises_clients: false, description: 'Wir machen Projekte.' }),
    ).toEqual([]);
  });

  it('never requires a description when the clinic advises clients', () => {
    expect(publishBlockers({ ...COMPLETE, advises_clients: true, description: '' })).toEqual([]);
  });
});

describe('memberBlockers', () => {
  it('additionally requires contact_email', () => {
    expect(memberBlockers({ ...COMPLETE, contact_email: '' })).toEqual(['contact_email']);
  });
});

describe('missingRequiredKeys', () => {
  it('reports every missing key for the given set', () => {
    const blank = { advises_clients: true };
    expect(missingRequiredKeys(blank, MEMBER_KEYS).sort()).toEqual([...MEMBER_KEYS].sort());
  });
});

describe('toRequiredLabels', () => {
  it('maps field keys to their German labels', () => {
    expect(toRequiredLabels(['website', 'description'])).toEqual(['Homepage', 'Beratungsarbeit']);
  });
});
