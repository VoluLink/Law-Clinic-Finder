import { describe, expect, it } from 'vitest';

import { clinicUpdateDocument, clinicNameReservationId } from './clinic-repository';

const editable = {
  name: ' Law Clinic Köln ',
  description: 'Beratung',
  region: 'Köln',
  contact_email: 'kontakt@example.org',
  website: 'https://example.org',
  legal_areas: 'Mietrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch',
  requirements: null,
  advises_clients: true,
};

describe(clinicUpdateDocument, () => {
  it('maps editable fields without publication or approval controls', () => {
    expect(clinicUpdateDocument(editable, new Date(0))).toEqual({
      name: 'Law Clinic Köln',
      description: 'Beratung',
      region: 'Köln',
      website: 'https://example.org',
      legalAreas: 'Mietrecht',
      targetClients: 'Studierende',
      languages: 'Deutsch',
      requirements: null,
      advisesClients: true,
      updatedAt: new Date(0),
    });
  });
});

describe(clinicNameReservationId, () => {
  it('treats case and surrounding whitespace as the same name', () => {
    expect(clinicNameReservationId(' Law Clinic Köln ')).toBe(
      clinicNameReservationId('law clinic köln'),
    );
  });
});
