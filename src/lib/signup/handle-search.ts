import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Logger } from '@/lib/logger';

import {
  DIRECTORY_COLUMNS,
  escapeLikePattern,
  toDirectoryMatch,
  type ClinicDirectoryRow,
  type DirectoryMatch,
} from './directory';

export const signupSearchSchema = z.object({ query: z.string().trim().max(200) });

/** Covers the whole directory (59 rows today) so the empty query browses
 *  rather than truncates; the UI scrolls instead of paginating. */
const MAX_RESULTS = 200;

export type SignupDeps = { adminClient: SupabaseClient; logger: Logger };

/**
 * Directory search for the claim flow. Runs on the service client so
 * unpublished clinics stay findable/claimable; only masked contact data
 * leaves the server. An empty query lists the directory unfiltered — the
 * signup screen browses before anything is typed.
 */
export async function searchDirectory(
  deps: SignupDeps,
  query: string,
): Promise<DirectoryMatch[] | null> {
  // Unapproved entries are not part of the directory yet: listing them would
  // publish a name before an admin agreed to it, and let a second person try to
  // claim an entry whose first claim is still open.
  const base = deps.adminClient
    .from('clinics')
    .select(DIRECTORY_COLUMNS)
    .eq('approval_status', 'approved');
  const filtered = query ? base.ilike('name', `%${escapeLikePattern(query)}%`) : base;
  const { data, error } = await filtered.order('name').limit(MAX_RESULTS);
  if (error) {
    deps.logger.warn('signup search failed', { reason: error.message });
    return null;
  }
  return ((data ?? []) as ClinicDirectoryRow[]).map(toDirectoryMatch);
}
