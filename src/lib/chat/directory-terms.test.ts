import { describe, expect, it } from 'vitest';

import { listDirectoryTerms } from './directory-terms';

type Row = {
  legal_areas: string | null;
  region: string | null;
  languages: string | null;
  target_clients: string | null;
};

type CallLog = Array<[string, unknown[]]>;

function createSupabaseMock(rows: Row[] | null, error: { message: string } | null = null) {
  const calls: CallLog = [];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return query;
    };
  }
  (query as { then: unknown }).then = (resolve: (value: unknown) => void) =>
    resolve({ data: rows, error });
  const client = { from: (table: string) => (calls.push(['from', [table]]), query) };
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
    region: 'Deutschlandweit',
    languages: 'Arabisch, Kurdisch',
    target_clients: 'Studierende',
  },
  { legal_areas: null, region: null, languages: null, target_clients: null },
];

describe('listDirectoryTerms', () => {
  it('returns the distinct, sorted vocabulary of every searchable dimension', async () => {
    const { client } = createSupabaseMock(rows);
    const result = JSON.parse(await listDirectoryTerms(client as never));
    expect(result).toEqual({
      legal_areas: ['Arbeitsrecht', 'Mietrecht', 'Zivilrecht (Mietrecht, Kaufrecht)'],
      regions: ['Deutschlandweit', 'Stadtgebiet Köln'],
      languages: ['Arabisch', 'Deutsch', 'Englisch', 'Kurdisch'],
      target_groups: ['Geflüchtete', 'Studierende'],
    });
  });

  it('pins the nationwide region first even when it sorts later alphabetically', async () => {
    const { client } = createSupabaseMock([
      { legal_areas: null, region: 'Aachen', languages: null, target_clients: null },
      { legal_areas: null, region: 'Deutschlandweit', languages: null, target_clients: null },
    ]);
    const { regions } = JSON.parse(await listDirectoryTerms(client as never));
    expect(regions).toEqual(['Deutschlandweit', 'Aachen']);
  });

  it('drops a prose cell that is too long to be a real term', async () => {
    const prose =
      'Wir beraten umfassend und individuell zu allen Fragen rund um das Mietrecht und Wohnungsrecht';
    const { client } = createSupabaseMock([
      { legal_areas: prose, region: null, languages: null, target_clients: null },
    ]);
    const { legal_areas } = JSON.parse(await listDirectoryTerms(client as never));
    expect(legal_areas).toEqual([]);
  });

  it('only reads published clinics', async () => {
    const { client, calls } = createSupabaseMock([]);
    await listDirectoryTerms(client as never);
    expect(calls).toContainEqual(['eq', ['is_published', true]]);
  });

  it('returns empty lists for an empty directory', async () => {
    const { client } = createSupabaseMock([]);
    expect(JSON.parse(await listDirectoryTerms(client as never))).toEqual({
      legal_areas: [],
      regions: [],
      languages: [],
      target_groups: [],
    });
  });

  it('throws when the database returns an error', async () => {
    const { client } = createSupabaseMock(null, { message: 'boom' });
    await expect(listDirectoryTerms(client as never)).rejects.toThrow(
      'directory terms lookup failed',
    );
  });
});
