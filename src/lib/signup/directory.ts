import { maskEmail } from './mask-email';

/** Clinic row shape for the claim flow: base columns + embedded profile link. */
export type ClinicDirectoryRow = {
  id: string;
  name: string;
  region: string | null;
  contact_email: string | null;
  profiles: { user_id: string }[] | { user_id: string } | null;
};

/**
 * What the public signup search exposes per clinic. Deliberately no address at
 * all, not even a masked one: an unauthenticated caller could otherwise walk the
 * directory and collect a recognisable fragment of every clinic's contact
 * address. Whether one is on file is enough to explain what will happen next.
 */
export type DirectoryMatch = {
  id: string;
  name: string;
  region: string | null;
  claimed: boolean;
  hasContactEmail: boolean;
};

/** The claim path additionally needs the masked address, but only to tell the
 *  person who just claimed which mailbox to open. */
export type ClaimMatch = DirectoryMatch & { maskedEmail: string | null };

export const DIRECTORY_COLUMNS = 'id, name, region, contact_email, profiles(user_id)';

export function toDirectoryMatch(row: ClinicDirectoryRow): ClaimMatch {
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
