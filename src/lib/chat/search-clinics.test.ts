import { describe, expect, it } from 'vitest';

import { searchClinics, searchClinicsInputSchema } from './search-clinics';

type CallLog = Array<[string, unknown[]]>;

const sampleRow = {
  name: 'Demo Clinic',
  description: 'Beratung',
  region: 'Hamburg',
  contact_email: 'a@example.org',
  website: 'https://example.org',
  legal_areas: 'Mietrecht; Vertragsrecht',
  target_clients: 'Alle',
  languages: 'DE, EN',
  requirements: null,
};

function createSupabaseMock(result: { data: unknown[] | null; error: { message: string } | null }) {
  const calls: CallLog = [];
  // Minimal chainable stand-in for the Supabase query builder (thenable at the end)
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'ilike', 'contains', 'or', 'limit']) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return query;
    };
  }
  (query as { then: unknown }).then = (resolve: (value: unknown) => void) => resolve(result);
  const client = {
    from: (table: string) => {
      calls.push(['from', [table]]);
      return query;
    },
  };
  return { client, calls };
}

describe('searchClinicsInputSchema', () => {
  it('accepts empty input (search all)', () => {
    expect(searchClinicsInputSchema.safeParse({}).success).toBe(true);
  });

  it('rejects oversized query strings', () => {
    expect(searchClinicsInputSchema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe(searchClinics, () => {
  it('only returns published clinics', async () => {
    const { client, calls } = createSupabaseMock({ data: [sampleRow], error: null });
    // Mock implements the subset of SupabaseClient the function touches
    await searchClinics(client as never, {});
    expect(calls).toContainEqual(['eq', ['is_published', true]]);
  });

  // This filter is the ONLY thing keeping unpublished clinics out of the
  // assistant's results: the chat route passes the service-role client, which
  // bypasses RLS (see 20260720120000_lockdown_grants). It must survive every
  // input shape, not just the empty one.
  it.each([
    ['no filters', {}],
    ['a city', { city: 'Hamburg' }],
    ['a legal area', { legal_area: 'Mietrecht' }],
    ['a language', { language: 'Deutsch' }],
    ['a target group', { target_group: 'Studierende' }],
    ['a free-text query', { query: 'Beratung' }],
    ['every filter at once', { query: 'Beratung', city: 'Hamburg', legal_area: 'Mietrecht' }],
  ])('still restricts to published clinics with %s', async (_label, input) => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, input);
    expect(calls).toContainEqual(['eq', ['is_published', true]]);
  });

  it('matches the region AND nationwide clinics when a city is given', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { city: 'Berlin' });
    const orCall = calls.find(([method]) => method === 'or');
    expect(String(orCall?.[1][0])).toContain('region.ilike.*Berlin*');
    expect(String(orCall?.[1][0])).toContain('deutschlandweit');
  });

  it('sanitizes PostgREST syntax out of the city filter', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { city: 'Ber)(%_lin' });
    const orCall = calls.find(([method]) => method === 'or');
    expect(String(orCall?.[1][0])).not.toMatch(/[)(%_]/);
  });

  it('filters legal areas by substring match', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { legal_area: 'Mietrecht' });
    expect(calls).toContainEqual(['ilike', ['legal_areas', '%Mietrecht%']]);
  });

  it('sanitizes wildcard characters out of the legal-area filter', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { legal_area: 'Miet%_recht' });
    const ilikeCall = calls.find(
      ([method, args]) => method === 'ilike' && args[0] === 'legal_areas',
    );
    expect(String(ilikeCall?.[1][1])).toMatch(/^%[^%_()]+%$/);
  });

  it('filters languages by substring match', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { language: 'Arabisch' });
    expect(calls).toContainEqual(['ilike', ['languages', '%Arabisch%']]);
  });

  it('filters target groups by substring match', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { target_group: 'Studierende' });
    expect(calls).toContainEqual(['ilike', ['target_clients', '%Studierende%']]);
  });

  it('sanitizes wildcard characters out of the language and target-group filters', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { language: 'Deu%_tsch', target_group: 'Stud)(ierende' });
    const ilikeArgs = calls
      .filter(([method]) => method === 'ilike')
      .map(([, args]) => String(args[1]));
    expect(ilikeArgs.every((arg) => /^%[^%_()]+%$/.test(arg))).toBe(true);
  });

  it('sanitizes PostgREST filter syntax out of free-text queries', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, { query: 'Miete,)(%_' });
    const orCall = calls.find(([method]) => method === 'or');
    const wildcardPayloads = String(orCall?.[1][0]).match(/\*[^*,]*\*/g);
    expect(String(wildcardPayloads)).not.toMatch(/[)(%_]/);
  });

  it('lets an unfiltered call reach past the whole directory', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, {});
    const limit = calls.find(([method]) => method === 'limit')?.[1][0];
    expect(Number(limit)).toBeGreaterThan(65);
  });

  it('truncates a long free-text field so a full scan cannot flood the context', async () => {
    const long = 'a'.repeat(5000);
    const { client } = createSupabaseMock({
      data: [{ ...sampleRow, requirements: long }],
      error: null,
    });
    const { clinics } = JSON.parse(await searchClinics(client as never, {}));
    expect(clinics[0].requirements.length).toBeLessThan(long.length);
    expect(clinics[0].requirements.endsWith('…')).toBe(true);
  });

  it('leaves a short field exactly as stored', async () => {
    const { client } = createSupabaseMock({ data: [sampleRow], error: null });
    const { clinics } = JSON.parse(await searchClinics(client as never, {}));
    expect(clinics[0].description).toBe(sampleRow.description);
  });

  it('returns the found clinics as JSON', async () => {
    const { client } = createSupabaseMock({ data: [sampleRow], error: null });
    const result = await searchClinics(client as never, {});
    expect(JSON.parse(result)).toEqual({ count: 1, clinics: [sampleRow] });
  });

  it('throws when the database returns an error', async () => {
    const { client } = createSupabaseMock({ data: null, error: { message: 'boom' } });
    await expect(searchClinics(client as never, {})).rejects.toThrow('clinic search failed');
  });
});
