import { describe, expect, it } from 'vitest';

import {
  clinicAdminSchema,
  clinicEditableSchema,
  clinicInviteSchema,
  clinicMemberSaveSchema,
  clinicSubmissionSchema,
} from './schema';

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.path[0]) ?? []);
}

const validClinic = {
  name: 'Law Clinic Musterstadt',
  description: 'Studentische Rechtsberatung.',
  region: 'Musterstadt',
  contact_email: 'contact@example.org',
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

  it('rejects executable website URL schemes', () => {
    expect(
      clinicEditableSchema.safeParse({ ...validClinic, website: 'javascript:alert(1)' }).success,
    ).toBe(false);
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
      clinicInviteSchema.safeParse({ name: 'Neue Clinic', contact_email: 'org@example.org' })
        .success,
    ).toBe(true);
    expect(clinicInviteSchema.safeParse({ name: 'Neue Clinic', contact_email: '' }).success).toBe(
      false,
    );
  });
});

describe('clinicMemberSaveSchema', () => {
  it('accepts a complete member entry', () => {
    expect(
      clinicMemberSaveSchema.safeParse({ ...validClinic, advises_clients: true }).success,
    ).toBe(true);
  });

  it('flags each blank required field on its own path', () => {
    const result = clinicMemberSaveSchema.safeParse({ ...validClinic, website: '', region: '  ' });
    expect(issuePaths(result)).toEqual(expect.arrayContaining(['website', 'region']));
  });

  it('requires the alternative text when the clinic does not advise clients', () => {
    const result = clinicMemberSaveSchema.safeParse({
      ...validClinic,
      advises_clients: false,
      description: '',
    });
    expect(issuePaths(result)).toContain('description');
  });

  it('accepts a non-advising clinic that explains its alternative', () => {
    const result = clinicMemberSaveSchema.safeParse({
      ...validClinic,
      advises_clients: false,
      description: 'Wir erarbeiten abstrakte Gesetzesvorschläge.',
    });
    expect(result.success).toBe(true);
  });
});

describe('clinicSubmissionSchema', () => {
  const submission = { ...validClinic, advises_clients: true };

  it('accepts a complete submission', () => {
    expect(clinicSubmissionSchema.safeParse(submission).success).toBe(true);
  });

  it('rejects a non-advising submission without the alternative text', () => {
    const result = clinicSubmissionSchema.safeParse({
      ...submission,
      advises_clients: false,
      description: '',
    });
    expect(issuePaths(result)).toContain('description');
  });

  it('rejects non-web homepage schemes', () => {
    expect(
      clinicSubmissionSchema.safeParse({ ...submission, website: 'data:text/html,test' }).success,
    ).toBe(false);
  });
});
