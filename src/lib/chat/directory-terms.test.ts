import { describe, expect, it } from 'vitest';

import { listDirectoryTerms } from './directory-terms';

type Row = {
  legal_areas: string | null;
  region: string | null;
  languages: string | null;
  target_clients: string | null;
};

type CallLog = Array<[string, unknown[]]>;

function createDirectoryMock(rows: Row[] | null, error: { message: string } | null = null) {
  const calls: CallLog = [];
  const client = {
    listPublished: async () => {
      calls.push(['listPublished', []]);
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
    findPublishedByIds: async () => [],
  };
  return { client, calls };
}

const rows: Row[] = [
  {
    legal_areas: 'Mietrecht; Zivilrecht (Mietrecht, Kaufrecht)',
    region: 'Stadtgebiet Köln',
    languages: 'Deutsch; Englisch',
    target_clients: 'Studierende; Geflüchtete',
  },
  {
    // `mietrecht` repeats the first row case-insensitively; comma-separated languages.
    legal_areas: 'mietrecht; Arbeitsrecht',
    region: 'Bundesweit',
    languages: 'Arabisch, Kurdisch',
    target_clients: 'Studierende',
  },
  { legal_areas: null, region: null, languages: null, target_clients: null },
];

describe('listDirectoryTerms', () => {
  it('returns the distinct, sorted vocabulary of every searchable dimension', async () => {
    const { client } = createDirectoryMock(rows);
    const result = JSON.parse(await listDirectoryTerms(client as never));
    expect(result).toEqual({
      legal_areas: ['Arbeitsrecht', 'Mietrecht', 'Zivilrecht (Mietrecht, Kaufrecht)'],
      regions: ['Bundesweit', 'Stadtgebiet Köln'],
      languages: ['Arabisch', 'Deutsch', 'Englisch', 'Kurdisch'],
      target_groups: ['Geflüchtete', 'Studierende'],
    });
  });

  it('pins the nationwide region first even when it sorts later alphabetically', async () => {
    const { client } = createDirectoryMock([
      { legal_areas: null, region: 'Aachen', languages: null, target_clients: null },
      { legal_areas: null, region: 'Bundesweit', languages: null, target_clients: null },
    ]);
    const { regions } = JSON.parse(await listDirectoryTerms(client as never));
    expect(regions).toEqual(['Bundesweit', 'Aachen']);
  });

  it('drops a prose cell that is too long to be a real term', async () => {
    const prose =
      'Wir beraten umfassend und individuell zu allen Fragen rund um das Mietrecht und Wohnungsrecht';
    const { client } = createDirectoryMock([
      { legal_areas: prose, region: null, languages: null, target_clients: null },
    ]);
    const { legal_areas } = JSON.parse(await listDirectoryTerms(client as never));
    expect(legal_areas).toEqual([]);
  });

  it('only reads through the published-directory boundary', async () => {
    const { client, calls } = createDirectoryMock([]);
    await listDirectoryTerms(client as never);
    expect(calls).toContainEqual(['listPublished', []]);
  });

  it('returns empty lists for an empty directory', async () => {
    const { client } = createDirectoryMock([]);
    expect(JSON.parse(await listDirectoryTerms(client as never))).toEqual({
      legal_areas: [],
      regions: [],
      languages: [],
      target_groups: [],
    });
  });

  it('throws when the database returns an error', async () => {
    const { client } = createDirectoryMock(null, { message: 'boom' });
    await expect(listDirectoryTerms(client as never)).rejects.toThrow(
      'directory terms lookup failed',
    );
  });
});
