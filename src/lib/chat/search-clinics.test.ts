import { describe, expect, it } from 'vitest';

import { searchClinics, searchClinicsInputSchema } from './search-clinics';

type CallLog = Array<[string, unknown[]]>;

const sampleRow = {
  id: 'ff000000-0000-0000-0000-000000000001',
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

function createSupabaseMock(result: {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
}) {
  const calls: CallLog = [];
  // Minimal chainable stand-in for the Supabase query builder (thenable at the end)
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'ilike', 'contains', 'or', 'limit', 'order', 'range']) {
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

  it('accepts a non-negative page offset', () => {
    expect(searchClinicsInputSchema.safeParse({ offset: 100 }).success).toBe(true);
  });

  it('rejects a negative page offset', () => {
    expect(searchClinicsInputSchema.safeParse({ offset: -1 }).success).toBe(false);
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
    expect(String(orCall?.[1][0])).toContain('bundesweit');
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

  it('reads the first page in a stable order', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null });
    await searchClinics(client as never, {});
    expect(calls).toContainEqual(['order', ['id', { ascending: true }]]);
    expect(calls).toContainEqual(['range', [0, 99]]);
  });

  it('requests the exact total number of matching clinics', async () => {
    const { client, calls } = createSupabaseMock({ data: [], error: null, count: 0 });
    await searchClinics(client as never, {});
    expect(calls).toContainEqual(['select', [expect.any(String), { count: 'exact' }]]);
  });

  it('never gives clinic contact emails to the model', async () => {
    const { client, calls } = createSupabaseMock({ data: [sampleRow], error: null });
    const result = JSON.parse(await searchClinics(client as never, {}));
    const select = calls.find(([method]) => method === 'select');
    expect(select?.[1][0]).not.toContain('contact_email');
    expect(result.clinics[0]).not.toHaveProperty('contact_email');
  });

  it('makes overflow beyond 100 matches visible to the assistant', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...sampleRow,
      id: `ff000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
    }));
    const { client } = createSupabaseMock({ data: firstPage, error: null, count: 101 });
    const result = JSON.parse(await searchClinics(client as never, {}));
    expect(result).toMatchObject({ count: 101, offset: 0, has_more: true, next_offset: 100 });
  });

  it('returns clinic 101 when the assistant requests the next page', async () => {
    const overflowClinic = {
      ...sampleRow,
      id: 'ff000000-0000-0000-0000-000000000101',
      name: 'Clinic 101',
    };
    const { client, calls } = createSupabaseMock({
      data: [overflowClinic],
      error: null,
      count: 101,
    });
    const result = JSON.parse(await searchClinics(client as never, { offset: 100 }));
    const expectedClinic: Record<string, unknown> = { ...overflowClinic };
    delete expectedClinic.contact_email;
    expect(result.clinics).toEqual([expectedClinic]);
    expect(calls).toContainEqual(['range', [100, 199]]);
    expect(result.has_more).toBe(false);
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
    const { client } = createSupabaseMock({ data: [sampleRow], error: null, count: 1 });
    const result = await searchClinics(client as never, {});
    expect(JSON.parse(result)).toEqual({
      count: 1,
      offset: 0,
      has_more: false,
      next_offset: null,
      clinics: [
        {
          id: sampleRow.id,
          name: sampleRow.name,
          description: sampleRow.description,
          region: sampleRow.region,
          website: sampleRow.website,
          legal_areas: sampleRow.legal_areas,
          target_clients: sampleRow.target_clients,
          languages: sampleRow.languages,
          requirements: sampleRow.requirements,
        },
      ],
    });
  });

  it('throws when the database returns an error', async () => {
    const { client } = createSupabaseMock({ data: null, error: { message: 'boom' } });
    await expect(searchClinics(client as never, {})).rejects.toThrow('clinic search failed');
  });
});
