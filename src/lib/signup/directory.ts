import { maskEmail } from './mask-email';

/** Clinic row shape for the claim flow: base columns + embedded profile link. */
export type ClinicDirectoryRow = {
  id: string;
  name: string;
  region: string | null;
  contact_email: string | null;
  profiles: { user_id: string }[] | { user_id: string } | null;
};

/** What the public signup API exposes per clinic — never the full address. */
export type DirectoryMatch = {
  id: string;
  name: string;
  region: string | null;
  claimed: boolean;
  hasContactEmail: boolean;
  maskedEmail: string | null;
};

export const DIRECTORY_COLUMNS = 'id, name, region, contact_email, profiles(user_id)';

export function toDirectoryMatch(row: ClinicDirectoryRow): DirectoryMatch {
  const claimed = Array.isArray(row.profiles) ? row.profiles.length > 0 : row.profiles !== null;
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    claimed,
    hasContactEmail: Boolean(row.contact_email),
    maskedEmail: row.contact_email ? maskEmail(row.contact_email) : null,
  };
}

/** Escape user input for ilike patterns (% and _ match literally). */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
