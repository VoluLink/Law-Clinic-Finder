import { describe, expect, it } from 'vitest';

import { recommendClinics, recommendClinicsInputSchema } from './recommend-clinics';

type Row = {
  id: string;
  name: string;
  region: string | null;
  legal_areas: string | null;
  website: string | null;
  contact_email: string | null;
};

const milcc: Row = {
  id: 'ff000000-0000-4000-8000-000000000001',
  name: 'Mietrecht Law Clinic Cologne',
  region: 'Stadtgebiet Köln',
  legal_areas: 'Mietrecht',
  website: 'https://milcc.de/',
  contact_email: 'contact@example.org',
};

const srk: Row = {
  id: 'ff000000-0000-4000-8000-000000000002',
  name: 'Studentische Rechtsberatung Köln',
  region: 'Köln',
  legal_areas: 'Allgemeines Zivilrecht; Behördengänge',
  website: 'https://srk.uni-koeln.de/',
  contact_email: null,
};

type CallLog = Array<[string, unknown[]]>;

function createDirectoryMock(rows: Row[]) {
  const calls: CallLog = [];
  const client = {
    listPublished: async () => [],
    findPublishedByIds: async (ids: string[]) => {
      calls.push(['findPublishedByIds', [ids]]);
      return rows;
    },
  };
  return { client, calls };
}

const picks = [
  { id: milcc.id, reason: 'Genau dein Rechtsgebiet.' },
  { id: srk.id, reason: 'Hilft auch bei Formularen.' },
];

const unknownId = 'ff000000-0000-4000-8000-000000000099';

describe('recommendClinicsInputSchema', () => {
  it('rejects an empty recommendation list', () => {
    expect(recommendClinicsInputSchema.safeParse({ clinics: [] }).success).toBe(false);
  });

  it('rejects a pick without a reason', () => {
    const result = recommendClinicsInputSchema.safeParse({ clinics: [{ id: milcc.id }] });
    expect(result.success).toBe(false);
  });

  it('rejects the old name-only identifier that collapses duplicate names', () => {
    const result = recommendClinicsInputSchema.safeParse({
      clinics: [{ name: milcc.name, reason: 'Passt.' }],
    });
    expect(result.success).toBe(false);
  });

  it('caps how many clinics one reply may recommend', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: `ff000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      reason: 'x',
    }));
    expect(recommendClinicsInputSchema.safeParse({ clinics: many }).success).toBe(false);
  });
});

describe('recommendClinics', () => {
  it('ranks the cards in the order the model chose, not the order the rows arrive', async () => {
    // Rows deliberately reversed relative to `picks`.
    const { client } = createDirectoryMock([srk, milcc]);
    const { recommendations } = await recommendClinics(client as never, { clinics: picks });
    expect(recommendations.map((r) => [r.rank, r.name])).toEqual([
      [1, milcc.name],
      [2, srk.name],
    ]);
  });

  it("carries the model's reason onto the matching card", async () => {
    const { client } = createDirectoryMock([milcc]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[0]] });
    expect(recommendations[0].reason).toBe('Genau dein Rechtsgebiet.');
  });

  it('carries the directory id onto the card so clicks can be attributed', async () => {
    const { client } = createDirectoryMock([milcc]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[0]] });
    expect(recommendations[0].id).toBe(milcc.id);
  });

  it('splits the semicolon-separated legal areas into tags', async () => {
    const { client } = createDirectoryMock([srk]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toEqual(['Allgemeines Zivilrecht', 'Behördengänge']);
  });

  // 11 of the 59 published rows separate areas with commas rather than semicolons.
  it('falls back to commas when a row uses no semicolons', async () => {
    const { client } = createDirectoryMock([
      { ...srk, legal_areas: 'Gesellschaftsrecht, Arbeitsrecht, Mietrecht' },
    ]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toEqual(['Gesellschaftsrecht', 'Arbeitsrecht', 'Mietrecht']);
  });

  it('keeps a parenthesised list as one area instead of splitting inside it', async () => {
    const { client } = createDirectoryMock([
      { ...srk, legal_areas: 'Asyl- und Aufenthaltsrecht (Asylverfahren, Aufenthaltstitel)' },
    ]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toEqual([
      'Asyl- und Aufenthaltsrecht (Asylverfahren, Aufenthaltstitel)',
    ]);
  });

  it('splits on top-level semicolons while leaving bracketed commas alone', async () => {
    const { client } = createDirectoryMock([
      { ...srk, legal_areas: 'Zivilrecht (Mietrecht, Kaufrecht); Verwaltungsrecht' },
    ]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toEqual([
      'Zivilrecht (Mietrecht, Kaufrecht)',
      'Verwaltungsrecht',
    ]);
  });

  it('caps the tags when a row holds prose instead of a list', async () => {
    const prose = Array.from({ length: 14 }, (_, i) => `Thema ${i}`).join(', ');
    const { client } = createDirectoryMock([{ ...srk, legal_areas: prose }]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toHaveLength(6);
  });

  it('drops empty segments from a trailing separator', async () => {
    const { client } = createDirectoryMock([{ ...srk, legal_areas: 'Mietrecht;;' }]);
    const { recommendations } = await recommendClinics(client as never, { clinics: [picks[1]] });
    expect(recommendations[0].areas).toEqual(['Mietrecht']);
  });

  it('only ever reads through the published-directory boundary', async () => {
    const { client, calls } = createDirectoryMock([milcc]);
    await recommendClinics(client as never, { clinics: [picks[0]] });
    expect(calls).toContainEqual(['findPublishedByIds', [[milcc.id]]]);
  });

  it('looks selected clinics up by their unique ids', async () => {
    const { client, calls } = createDirectoryMock([milcc, srk]);
    await recommendClinics(client as never, { clinics: picks });
    expect(calls).toContainEqual(['findPublishedByIds', [[milcc.id, srk.id]]]);
  });

  it('drops a hallucinated clinic instead of inventing a card for it', async () => {
    const { client } = createDirectoryMock([milcc]);
    const { recommendations } = await recommendClinics(client as never, {
      clinics: [picks[0], { id: unknownId, reason: 'existiert nicht' }],
    });
    expect(recommendations.map((r) => r.name)).toEqual([milcc.name]);
  });

  it('tells the model which ids it made up so it can correct itself', async () => {
    const { client } = createDirectoryMock([milcc]);
    const { json } = await recommendClinics(client as never, {
      clinics: [picks[0], { id: unknownId, reason: 'existiert nicht' }],
    });
    expect(JSON.parse(json)).toEqual({ shown: 1, unknown: [unknownId] });
  });

  it('keeps a selected clinic email out of the model tool result', async () => {
    const { client } = createDirectoryMock([milcc]);
    const { json, recommendations } = await recommendClinics(client as never, {
      clinics: [picks[0]],
    });
    expect(json).not.toContain(milcc.contact_email);
    expect(recommendations[0].email).toBe(milcc.contact_email);
  });

  it('keeps two published clinics with the exact same name distinct', async () => {
    const sameName = { ...srk, name: milcc.name };
    const { client } = createDirectoryMock([sameName, milcc]);
    const { recommendations } = await recommendClinics(client as never, { clinics: picks });
    expect(recommendations.map((clinic) => clinic.id)).toEqual([milcc.id, srk.id]);
  });

  it('shows at most the configured number of cards', async () => {
    const { client } = createDirectoryMock([milcc, srk]);
    const { recommendations } = await recommendClinics(client as never, { clinics: picks }, 1);
    expect(recommendations.map((r) => r.name)).toEqual([milcc.name]);
  });

  it('drops unknown ids before applying the cap, so real clinics are not pushed out', async () => {
    const { client } = createDirectoryMock([milcc, srk]);
    const { recommendations } = await recommendClinics(
      client as never,
      { clinics: [{ id: unknownId, reason: 'weg' }, ...picks] },
      2,
    );
    expect(recommendations.map((r) => r.name)).toEqual([milcc.name, srk.name]);
  });

  it('renumbers ranks contiguously after an unknown clinic is dropped', async () => {
    const { client } = createDirectoryMock([srk]);
    const { recommendations } = await recommendClinics(client as never, {
      clinics: [{ id: unknownId, reason: 'weg' }, picks[1]],
    });
    expect(recommendations[0].rank).toBe(1);
  });
});
