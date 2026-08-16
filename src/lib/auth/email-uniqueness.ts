import type { SupabaseClient } from '@supabase/supabase-js';

import { escapeLikePattern } from '@/lib/signup/directory';

/**
 * One address, one role. auth.users.email is unique and profiles.user_id is the
 * primary key, so a single address can never carry two roles at once — but the
 * self-service signup paths and the admin invite can each try to claim an
 * address the other side already uses, which would fail as a raw constraint
 * error deep inside a flow. These checks catch it at the boundary.
 *
 * Admins are looked up through their profile rows rather than a listUsers()
 * scan, so the cost scales with the number of admins, not the user base.
 */
async function adminEmails(adminClient: SupabaseClient): Promise<Set<string>> {
  const { data } = await adminClient.from('profiles').select('user_id').eq('role', 'admin');
  const ids = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  const users = await Promise.all(ids.map((id) => adminClient.auth.admin.getUserById(id)));
  const emails = users
    .map((user) => user.data.user?.email?.toLowerCase())
    .filter((email): email is string => Boolean(email));
  return new Set(emails);
}

/** True when the address already belongs to an admin account. */
export async function isAdminEmail(adminClient: SupabaseClient, email: string): Promise<boolean> {
  const emails = await adminEmails(adminClient);
  return emails.has(email.trim().toLowerCase());
}

/**
 * True when the address is already a clinic's login address. Clinic logins are
 * always created from `clinics.contact_email`, so that column is the register
 * of clinic-side addresses.
 */
export async function isClinicEmail(adminClient: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await adminClient
    .from('clinics')
    .select('id')
    .ilike('contact_email', escapeLikePattern(email.trim()))
    .limit(1);
  return ((data ?? []) as { id: string }[]).length > 0;
}
