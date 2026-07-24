import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const searchClinicsInputSchema = z.object({
  query: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  legal_area: z.string().max(100).optional(),
  language: z.string().max(100).optional(),
  target_group: z.string().max(100).optional(),
});

export type SearchClinicsInput = z.infer<typeof searchClinicsInputSchema>;

const CLINIC_COLUMNS =
  'name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements';
/**
 * High enough that an unfiltered call returns the whole directory (59 rows
 * today), so the model can scan everything itself rather than being handed a
 * pre-truncated shortlist. The token cost of that is paid by TRUNCATED_FIELDS
 * below instead of by hiding rows.
 */
const MAX_RESULTS = 100;

/**
 * Free-text columns are capped per row before the result reaches the model:
 * `requirements` alone may hold 4 000 characters, and a full-directory scan of
 * untrimmed rows would dominate the context window. The cap keeps enough to
 * judge fit; the card and the clinic's own site carry the full text.
 */
const TRUNCATED_FIELDS = ['description', 'requirements', 'target_clients'] as const;
const MAX_FIELD_CHARS = 400;

/**
 * Strip PostgREST filter metacharacters from free text so a user-supplied
 * term can never break out of a filter string. Wildcards are added by us
 * afterwards, never taken from the input.
 */
function sanitizeFreeText(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Runs the `search_clinics` tool query against Supabase. Only published
 * clinics are ever returned. A city filter also matches nationwide clinics
 * (region "Bundesweit"). Returns a JSON string for the tool result.
 */
export async function searchClinics(client: SupabaseClient, input: unknown): Promise<string> {
  const { query, city, legal_area, language, target_group } = searchClinicsInputSchema.parse(input);

  let builder = client.from('clinics').select(CLINIC_COLUMNS).eq('is_published', true);

  const cityTerm = city ? sanitizeFreeText(city) : '';
  if (cityTerm) {
    builder = builder.or(`region.ilike.*${cityTerm}*,region.ilike.*bundesweit*`);
  }

  const areaTerm = legal_area ? sanitizeFreeText(legal_area) : '';
  if (areaTerm) builder = builder.ilike('legal_areas', `%${areaTerm}%`);

  const languageTerm = language ? sanitizeFreeText(language) : '';
  if (languageTerm) builder = builder.ilike('languages', `%${languageTerm}%`);

  const clientTerm = target_group ? sanitizeFreeText(target_group) : '';
  if (clientTerm) builder = builder.ilike('target_clients', `%${clientTerm}%`);

  const queryTerm = query ? sanitizeFreeText(query) : '';
  if (queryTerm) {
    builder = builder.or(
      `name.ilike.*${queryTerm}*,description.ilike.*${queryTerm}*,` +
        `legal_areas.ilike.*${queryTerm}*,target_clients.ilike.*${queryTerm}*`,
    );
  }

  const { data, error } = await builder.limit(MAX_RESULTS);
  if (error) throw new Error('clinic search failed');

  // `select` with a string projection is untyped, so the row shape is unknown here.
  const clinics = (data ?? []).map((row) => truncateLongFields(row as unknown as ClinicRow));
  return JSON.stringify({ count: clinics.length, clinics });
}

type ClinicRow = Record<string, unknown>;

function truncateLongFields(row: ClinicRow): ClinicRow {
  const trimmed = { ...row };
  for (const field of TRUNCATED_FIELDS) {
    const value = trimmed[field];
    if (typeof value === 'string' && value.length > MAX_FIELD_CHARS) {
      trimmed[field] = `${value.slice(0, MAX_FIELD_CHARS)}…`;
    }
  }
  return trimmed;
}
