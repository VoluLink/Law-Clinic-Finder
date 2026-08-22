import { z } from 'zod';

import { parseMultiValue } from '@/lib/clinics/options';
import type { ClinicDirectoryRepository } from '@/lib/clinics/directory-repository';

/** Beyond this a cell is prose, not a term — keep it out of the vocabulary. */
const MAX_TERM_CHARS = 60;

/** Nationwide sentinel; surfaced first so the model treats it as the catch-all region. */
const NATIONWIDE = 'Bundesweit';

const rowSchema = z.object({
  legal_areas: z.string().nullable().default(null),
  region: z.string().nullable().default(null),
  languages: z.string().nullable().default(null),
  target_clients: z.string().nullable().default(null),
});

type Row = z.infer<typeof rowSchema>;

export type DirectoryTerms = {
  legal_areas: string[];
  regions: string[];
  languages: string[];
  target_groups: string[];
};

async function loadRows(repository: ClinicDirectoryRepository): Promise<unknown[]> {
  try {
    return await repository.listPublished();
  } catch (cause) {
    throw new Error('directory terms lookup failed', { cause });
  }
}

/**
 * Lists the distinct legal areas, regions, languages and target groups that
 * actually appear across published clinics, as JSON. The columns are free text,
 * so the vocabulary is derived live on every call — an admin edit shows up on
 * the next lookup. The model consults it to search with real directory terms
 * instead of synonyms that would not substring-match.
 */
export async function listDirectoryTerms(repository: ClinicDirectoryRepository): Promise<string> {
  const data = await loadRows(repository);
  const rows = data.flatMap((row) => {
    const parsed = rowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
  const terms: DirectoryTerms = {
    legal_areas: collect(rows, (row) => row.legal_areas),
    regions: pinNationwide(collect(rows, (row) => row.region)),
    languages: collect(rows, (row) => row.languages),
    target_groups: collect(rows, (row) => row.target_clients),
  };
  return JSON.stringify(terms);
}

/** Splits every cell, drops prose, de-dupes case-insensitively (first spelling wins), sorts. */
function collect(rows: Row[], pick: (row: Row) => string | null): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    for (const term of parseMultiValue(pick(row))) {
      const key = term.toLowerCase();
      if (term.length <= MAX_TERM_CHARS && !seen.has(key)) seen.set(key, term);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'de'));
}

function pinNationwide(regions: string[]): string[] {
  const rest = regions.filter((region) => region.toLowerCase() !== NATIONWIDE.toLowerCase());
  return rest.length === regions.length ? regions : [NATIONWIDE, ...rest];
}
