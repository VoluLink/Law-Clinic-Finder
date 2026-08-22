import { describe, expect, it, vi } from 'vitest';

import type { ClinicDirectoryRepository, PublicClinic } from '@/lib/clinics/directory-repository';

import { searchClinics, searchClinicsInputSchema } from './search-clinics';

const sampleRow: PublicClinic = {
  id: 'ff000000-0000-4000-8000-000000000001',
  name: 'Demo Clinic',
  description: 'Beratung',
  region: 'Hamburg',
  website: 'https://example.org',
  legal_areas: 'Mietrecht; Vertragsrecht',
  target_clients: 'Studierende',
  languages: 'Deutsch, Englisch',
  requirements: null,
};

function createRepository(rows: PublicClinic[]): ClinicDirectoryRepository {
  return {
    listPublished: vi.fn().mockResolvedValue(rows),
    findPublishedByIds: vi.fn().mockResolvedValue([]),
  };
}

async function result(rows: PublicClinic[], input: unknown = {}) {
  return JSON.parse(await searchClinics(createRepository(rows), input));
}

describe('searchClinicsInputSchema', () => {
  it('accepts an empty search', () => {
    expect(searchClinicsInputSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an oversized query', () => {
    expect(searchClinicsInputSchema.safeParse({ query: 'a'.repeat(201) }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(searchClinicsInputSchema.safeParse({ offset: -1 }).success).toBe(false);
  });
});

describe(searchClinics, () => {
  it('reads only through the published-directory boundary', async () => {
    const repository = createRepository([sampleRow]);
    await searchClinics(repository, {});
    expect(repository.listPublished).toHaveBeenCalledOnce();
  });

  it('matches a city case-insensitively', async () => {
    expect((await result([sampleRow], { city: 'HAMBURG' })).count).toBe(1);
  });

  it('matches nationwide clinics for every city', async () => {
    const nationwide = { ...sampleRow, region: 'Bundesweit' };
    expect((await result([nationwide], { city: 'Berlin' })).count).toBe(1);
  });

  it('sanitizes punctuation before city matching', async () => {
    expect((await result([sampleRow], { city: 'Hamburg%_()' })).count).toBe(1);
  });

  it('filters legal areas by substring', async () => {
    expect((await result([sampleRow], { legal_area: 'Mietrecht' })).count).toBe(1);
  });

  it('filters languages by substring', async () => {
    expect((await result([sampleRow], { language: 'Englisch' })).count).toBe(1);
  });

  it('filters target groups by substring', async () => {
    expect((await result([sampleRow], { target_group: 'Studierende' })).count).toBe(1);
  });

  it('applies all filters together', async () => {
    const output = await result([sampleRow], {
      city: 'Hamburg',
      legal_area: 'Mietrecht',
      language: 'Deutsch',
      target_group: 'Studierende',
      query: 'Beratung',
    });
    expect(output.count).toBe(1);
  });

  it('returns no row when one filter differs', async () => {
    expect((await result([sampleRow], { legal_area: 'Strafrecht' })).count).toBe(0);
  });

  it('sorts each result page by stable clinic id', async () => {
    const later = { ...sampleRow, id: 'ff000000-0000-4000-8000-000000000002' };
    const output = await result([later, sampleRow]);
    expect(output.clinics.map((clinic: PublicClinic) => clinic.id)).toEqual([
      sampleRow.id,
      later.id,
    ]);
  });

  it('reports pagination beyond one hundred matches', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...sampleRow,
      id: `ff000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    expect(await result(rows)).toMatchObject({
      count: 101,
      has_more: true,
      next_offset: 100,
    });
  });

  it('returns the second page from the requested offset', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...sampleRow,
      id: `ff000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    expect((await result(rows, { offset: 100 })).clinics).toHaveLength(1);
  });

  it('truncates long free-text fields', async () => {
    const output = await result([{ ...sampleRow, requirements: 'a'.repeat(5000) }]);
    expect(output.clinics[0].requirements).toHaveLength(401);
  });

  it('does not include private contact e-mail fields', async () => {
    expect(JSON.stringify(await result([sampleRow]))).not.toContain('contact_email');
  });

  it('propagates a directory read failure', async () => {
    const repository = createRepository([]);
    vi.mocked(repository.listPublished).mockRejectedValue(new Error('unavailable'));
    await expect(searchClinics(repository, {})).rejects.toThrow('clinic search failed');
  });
});
