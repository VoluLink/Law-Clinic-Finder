import { describe, expect, it } from 'vitest';

import { clinicAdminSchema, clinicEditableSchema, clinicInviteSchema } from './schema';

const validClinic = {
  name: 'Law Clinic Musterstadt',
  description: 'Studentische Rechtsberatung.',
  region: 'Musterstadt',
  contact_email: 'kontakt@lawclinic-musterstadt.de',
  website: 'https://lawclinic-musterstadt.de',
  legal_areas: 'Mietrecht; Vertragsrecht',
  target_clients: 'Alle',
  languages: 'DE, EN',
  requirements: 'Kein Strafrecht.',
};

describe('clinicEditableSchema', () => {
  it('accepts a complete clinic', () => {
    expect(clinicEditableSchema.safeParse(validClinic).success).toBe(true);
  });

  it('normalises empty optional strings to null', () => {
    const parsed = clinicEditableSchema.parse({
      ...validClinic,
      description: '',
      contact_email: '',
      website: '',
    });
    expect(parsed.description).toBeNull();
    expect(parsed.contact_email).toBeNull();
    expect(parsed.website).toBeNull();
  });

  it('rejects a missing name', () => {
    expect(clinicEditableSchema.safeParse({ ...validClinic, name: '  ' }).success).toBe(false);
  });

  it('rejects invalid email addresses', () => {
    const result = clinicEditableSchema.safeParse({ ...validClinic, contact_email: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid website URLs', () => {
    expect(clinicEditableSchema.safeParse({ ...validClinic, website: 'not a url' }).success).toBe(
      false,
    );
  });

  it('does not allow publishing through the editable schema', () => {
    const parsed = clinicEditableSchema.parse({ ...validClinic, is_published: true });
    expect(parsed).not.toHaveProperty('is_published');
  });
});

describe('clinicAdminSchema', () => {
  it('adds the publish flag', () => {
    const parsed = clinicAdminSchema.parse({ ...validClinic, is_published: true });
    expect(parsed.is_published).toBe(true);
  });
});

describe('clinicInviteSchema', () => {
  it('requires name and a valid login email', () => {
    expect(
      clinicInviteSchema.safeParse({ name: 'Neue Clinic', contact_email: 'org@clinic.de' }).success,
    ).toBe(true);
    expect(clinicInviteSchema.safeParse({ name: 'Neue Clinic', contact_email: '' }).success).toBe(
      false,
    );
  });
});
