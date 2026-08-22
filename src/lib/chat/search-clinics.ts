import { z } from 'zod';

import type { ClinicDirectoryRepository, PublicClinic } from '@/lib/clinics/directory-repository';

export const searchClinicsInputSchema = z.object({
  query: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  legal_area: z.string().max(100).optional(),
  language: z.string().max(100).optional(),
  target_group: z.string().max(100).optional(),
  offset: z.number().int().nonnegative().default(0),
});

export type SearchClinicsInput = z.infer<typeof searchClinicsInputSchema>;

const RESULTS_PER_PAGE = 100;
const MAX_FIELD_CHARS = 400;

function sanitizeFreeText(value: string | undefined): string {
  return (value ?? '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de');
}

function includes(value: string | null, term: string): boolean {
  return !term || (value ?? '').toLocaleLowerCase('de').includes(term);
}

function matchesClinic(clinic: PublicClinic, input: SearchClinicsInput): boolean {
  const city = sanitizeFreeText(input.city);
  const cityMatches = includes(clinic.region, city) || includes(clinic.region, 'bundesweit');
  if (city && !cityMatches) return false;
  if (!includes(clinic.legal_areas, sanitizeFreeText(input.legal_area))) return false;
  if (!includes(clinic.languages, sanitizeFreeText(input.language))) return false;
  if (!includes(clinic.target_clients, sanitizeFreeText(input.target_group))) return false;
  return matchesQuery(clinic, sanitizeFreeText(input.query));
}

function matchesQuery(clinic: PublicClinic, query: string): boolean {
  if (!query) return true;
  return [clinic.name, clinic.description, clinic.legal_areas, clinic.target_clients].some(
    (value) => includes(value, query),
  );
}

function truncate(value: string | null): string | null {
  if (!value || value.length <= MAX_FIELD_CHARS) return value;
  return `${value.slice(0, MAX_FIELD_CHARS)}…`;
}

function toToolClinic(clinic: PublicClinic): PublicClinic {
  return {
    ...clinic,
    description: truncate(clinic.description),
    target_clients: truncate(clinic.target_clients),
    requirements: truncate(clinic.requirements),
  };
}

async function loadPublished(repository: ClinicDirectoryRepository): Promise<PublicClinic[]> {
  try {
    return await repository.listPublished();
  } catch (cause) {
    throw new Error('clinic search failed', { cause });
  }
}

export async function searchClinics(
  repository: ClinicDirectoryRepository,
  input: unknown,
): Promise<string> {
  const filters = searchClinicsInputSchema.parse(input);
  const rows = await loadPublished(repository);
  const matches = rows.filter((clinic) => matchesClinic(clinic, filters));
  matches.sort((left, right) => left.id.localeCompare(right.id));
  const clinics = matches
    .slice(filters.offset, filters.offset + RESULTS_PER_PAGE)
    .map(toToolClinic);
  const nextOffset = filters.offset + clinics.length;
  return JSON.stringify({
    count: matches.length,
    offset: filters.offset,
    has_more: nextOffset < matches.length,
    next_offset: nextOffset < matches.length ? nextOffset : null,
    clinics,
  });
}
