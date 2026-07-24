/**
 * Single source for "is this clinic entry complete enough?". Every gate — admin
 * publish, auto-publish on invite, member save, self-signup — asks the same
 * question here so the required set can never drift between surfaces.
 *
 * Storage stays lenient (drafts may be incomplete); completeness is enforced
 * only when publishing or when a member saves their own entry.
 */

export type ClinicRequirementFields = {
  name?: string | null;
  website?: string | null;
  contact_email?: string | null;
  region?: string | null;
  legal_areas?: string | null;
  target_clients?: string | null;
  languages?: string | null;
  description?: string | null;
  advises_clients?: boolean | null;
};

export type RequiredKey = keyof ClinicRequirementFields;

/** Fields an admin must fill before publishing. contact_email is omitted — it is
 *  the login address and is always present on admin-created rows. */
export const PUBLISH_KEYS = [
  'name',
  'website',
  'region',
  'legal_areas',
  'target_clients',
  'languages',
] as const satisfies readonly RequiredKey[];

/** Fields a clinic member must fill to register or save their own entry. */
export const MEMBER_KEYS = [
  'name',
  'website',
  'contact_email',
  'region',
  'legal_areas',
  'target_clients',
  'languages',
] as const satisfies readonly RequiredKey[];

export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  website: 'Homepage',
  contact_email: 'Beratungsemail',
  region: 'Region',
  legal_areas: 'Rechtsgebiet',
  target_clients: 'Mandant:innen',
  languages: 'Sprache',
  description: 'Beratungsarbeit',
};

function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A clinic that does not advise clients must explain its alternative service. */
function needsAlternativeText(row: ClinicRequirementFields): boolean {
  return row.advises_clients === false && !isFilled(row.description);
}

export function missingRequiredKeys(
  row: ClinicRequirementFields,
  keys: readonly RequiredKey[],
): string[] {
  const missing = keys.filter((key) => !isFilled(row[key])) as string[];
  if (needsAlternativeText(row)) missing.push('description');
  return missing;
}

export function publishBlockers(row: ClinicRequirementFields): string[] {
  return missingRequiredKeys(row, PUBLISH_KEYS);
}

export function memberBlockers(row: ClinicRequirementFields): string[] {
  return missingRequiredKeys(row, MEMBER_KEYS);
}

export function toRequiredLabels(keys: string[]): string[] {
  return keys.map((key) => REQUIRED_FIELD_LABELS[key] ?? key);
}

/** The columns a publish gate must read to evaluate completeness. */
export const REQUIREMENT_COLUMNS =
  'name, website, region, legal_areas, target_clients, languages, advises_clients, description';
