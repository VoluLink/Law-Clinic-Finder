import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { ClinicRecommendation } from './stream-protocol';

/** Bounds the shortlist so one reply cannot bury the user in cards. */
const MAX_RECOMMENDATIONS = 8;

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
    .max(MAX_RECOMMENDATIONS),
});

export type RecommendClinicsInput = z.infer<typeof recommendClinicsInputSchema>;

const CARD_COLUMNS = 'name, region, legal_areas, website, contact_email';

const rowSchema = z.object({
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
  const recommendations = clinics.flatMap((pick) => {
    const row = byName.get(pick.name);
    return row ? [toCard(row, pick.reason)] : [];
  });
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
    rank: 0,
    name: row.name,
    region: row.region,
    areas: splitAreas(row.legal_areas),
    reason,
    website: row.website,
    email: row.contact_email,
  };
}

/**
 * `legal_areas` is free text and the directory is inconsistent: most rows
 * separate with `;`, but a handful use `,` — and several of those wrap a list
 * in parentheses ("Zivilrecht (Mietrecht, Kaufrecht)"), where a naive comma
 * split would shred one area into fragments. So: prefer the semicolon when the
 * row has one, and only ever split at bracket depth zero.
 */
function splitAreas(value: string | null): string[] {
  if (!value) return [];
  const separator = value.includes(';') ? ';' : ',';
  return splitTopLevel(value, separator)
    .map((area) => area.trim())
    .filter(Boolean)
    .slice(0, MAX_AREAS);
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  return [...parts, current];
}
