import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const searchClinicsInputSchema = z.object({
  query: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  legal_area: z.string().max(100).optional(),
  language: z.string().max(100).optional(),
  target_group: z.string().max(100).optional(),
  offset: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Zero-based offset from a previous response's next_offset."),
});

export type SearchClinicsInput = z.infer<typeof searchClinicsInputSchema>;

const CLINIC_COLUMNS =
  'id, name, description, region, contact_email, website, legal_areas, ' +
  'target_clients, languages, requirements';
/**
 * Bounded pages keep a large directory from exhausting the model context. The
 * response exposes the exact total and next offset, so no later row is hidden.
 */
const RESULTS_PER_PAGE = 100;

/**
 * Free-text columns are capped per row before the result reaches the model:
 * `requirements` alone may hold 4 000 characters, and a full-directory scan of
 * untrimmed rows would dominate the context window. The cap keeps enough to
 * judge fit; the card and the clinic's own site carry the full text.
 */
const TRUNCATED_FIELDS = ['description', 'requirements', 'target_clients'] as const;
const FILTER_COLUMNS = [
  ['legal_areas', 'legal_area'],
  ['languages', 'language'],
  ['target_clients', 'target_group'],
] as const;
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
  const filters = searchClinicsInputSchema.parse(input);
  const { data, error, count } = await buildSearchQuery(client, filters).range(
    filters.offset,
    filters.offset + RESULTS_PER_PAGE - 1,
  );
  if (error) throw new Error('clinic search failed');

  const rows = data ?? [];
  const clinics = rows.map((row) => truncateLongFields(row as unknown as ClinicRow));
  const total = count ?? filters.offset + clinics.length;
  const hasMore =
    count == null ? clinics.length === RESULTS_PER_PAGE : total > filters.offset + clinics.length;
  return JSON.stringify({
    count: total,
    offset: filters.offset,
    has_more: hasMore,
    next_offset: hasMore ? filters.offset + clinics.length : null,
    clinics,
  });
}

function buildSearchQuery(client: SupabaseClient, input: SearchClinicsInput) {
  let builder = client
    .from('clinics')
    .select(CLINIC_COLUMNS, { count: 'exact' })
    .eq('is_published', true);

  const cityTerm = input.city ? sanitizeFreeText(input.city) : '';
  if (cityTerm) {
    builder = builder.or(`region.ilike.*${cityTerm}*,region.ilike.*bundesweit*`);
  }

  for (const [column, inputKey] of FILTER_COLUMNS) {
    const value = input[inputKey];
    const term = value ? sanitizeFreeText(value) : '';
    if (term) builder = builder.ilike(column, `%${term}%`);
  }

  const queryTerm = input.query ? sanitizeFreeText(input.query) : '';
  if (queryTerm) {
    builder = builder.or(
      `name.ilike.*${queryTerm}*,description.ilike.*${queryTerm}*,` +
        `legal_areas.ilike.*${queryTerm}*,target_clients.ilike.*${queryTerm}*`,
    );
  }
  return builder.order('id', { ascending: true });
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
