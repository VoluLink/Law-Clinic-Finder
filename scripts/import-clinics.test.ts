import { describe, expect, it } from 'vitest';

import { parseClinicImport, parseClinicImportArguments } from './import-clinics';

const CLINIC = {
  name: 'Law Clinic',
  website: 'https://example.org',
  region: 'Berlin',
  legal_areas: 'Mietrecht',
  target_clients: null,
  languages: 'Deutsch',
  requirements: null,
  is_published: true,
};

describe(parseClinicImport, () => {
  it('adds safe defaults for the complete Firebase clinic shape', () => {
    expect(parseClinicImport([CLINIC])[0]).toMatchObject({
      description: null,
      advises_clients: true,
    });
  });

  it('rejects names that collide after canonical normalization', () => {
    expect(() => parseClinicImport([CLINIC, { ...CLINIC, name: ' law clinic ' }])).toThrow(
      /duplicate/i,
    );
  });

  it('rejects executable website schemes', () => {
    expect(() => parseClinicImport([{ ...CLINIC, website: 'javascript:alert(1)' }])).toThrow();
  });
});

describe(parseClinicImportArguments, () => {
  it('does not mistake a confirmation value for the JSON path', () => {
    expect(
      parseClinicImportArguments([
        '--confirm-target',
        'law-clinic-finder',
        'clinics.json',
        '--apply',
      ]),
    ).toEqual({ jsonPath: 'clinics.json', apply: true });
  });

  it('rejects unknown flags', () => {
    expect(() => parseClinicImportArguments(['clinics.json', '--force'])).toThrow(/unknown/i);
  });
});
