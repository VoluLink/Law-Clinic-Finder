import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { parseMultiValue } from '@/lib/clinics/options';
import { MAX_CHAT_RECOMMENDATIONS } from '@/lib/settings';

import type { ClinicRecommendation } from './stream-protocol';

/**
 * A few directory rows hold a prose sentence in `legal_areas` rather than a
 * list, which splits into a dozen fragments. Capping keeps those cards the same
 * shape as every other card instead of a wall of chips.
 */
const MAX_AREAS = 6;

export const recommendClinicsInputSchema = z.object({
  clinics: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        reason: z.string().min(1).max(600),
      }),
    )
    .min(1)
    // Static ceiling: this schema is turned into the tool definition at module
    // load, so it cannot depend on the admin setting. The configured, lower
    // limit is applied to the result below.
    .max(MAX_CHAT_RECOMMENDATIONS),
});

export type RecommendClinicsInput = z.infer<typeof recommendClinicsInputSchema>;

const CARD_COLUMNS = 'id, name, region, legal_areas, website, contact_email';

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string().nullable().default(null),
  legal_areas: z.string().nullable().default(null),
  website: z.string().nullable().default(null),
  contact_email: z.string().nullable().default(null),
});

export type RecommendClinicsResult = {
  /** Tool result handed back to the model. */
  json: string;
  recommendations: ClinicRecommendation[];
};

/**
 * Turns the model's shortlist into cards the UI can render.
 *
 * Every field except the reason comes from the database, looked up by name —
 * the model chooses *which* clinics and *why*, never what the card says about
 * them. A name that matches no published row is dropped and reported back, so
 * a hallucinated clinic can never reach the user as a real recommendation.
 */
export async function recommendClinics(
  client: SupabaseClient,
  input: unknown,
  maxCards: number = MAX_CHAT_RECOMMENDATIONS,
): Promise<RecommendClinicsResult> {
  const { clinics } = recommendClinicsInputSchema.parse(input);
  const names = clinics.map((pick) => pick.name);
  const { data, error } = await client
    .from('clinics')
    .select(CARD_COLUMNS)
    .eq('is_published', true)
    .in('name', names);
  if (error) throw new Error('clinic lookup failed');

  const byName = new Map(
    (data ?? []).flatMap((row) => {
      const parsed = rowSchema.safeParse(row);
      return parsed.success ? ([[parsed.data.name, parsed.data]] as const) : [];
    }),
  );

  const unknown = names.filter((name) => !byName.has(name));
  const recommendations = clinics
    .flatMap((pick) => {
      const row = byName.get(pick.name);
      return row ? [toCard(row, pick.reason)] : [];
    })
    // Trim to the configured cap only after unknown names are gone, so a
    // hallucinated pick cannot push a real clinic off the end of the list.
    .slice(0, maxCards);
  // Rank after filtering so a dropped entry never leaves a gap in the numbering.
  recommendations.forEach((card, index) => {
    card.rank = index + 1;
  });

  return {
    json: JSON.stringify({ shown: recommendations.length, unknown }),
    recommendations,
  };
}

function toCard(row: z.infer<typeof rowSchema>, reason: string): ClinicRecommendation {
  return {
    id: row.id,
    rank: 0,
    name: row.name,
    region: row.region,
    // `legal_areas` is free text; parseMultiValue handles the inconsistent
    // separators, MAX_AREAS caps a prose row so it is not a wall of chips.
    areas: parseMultiValue(row.legal_areas).slice(0, MAX_AREAS),
    reason,
    website: row.website,
    email: row.contact_email,
  };
}
