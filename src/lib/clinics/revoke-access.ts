import type { SupabaseClient } from '@supabase/supabase-js';

export type RevokeAccessOptions = {
  /** Also hide the entry from the finder — used when a clinic leaves itself. */
  unpublish: boolean;
  /** Remove the address used for contact and login — used for an admin reset. */
  clearContactEmail: boolean;
};

type ClinicAccessUpdate = {
  is_published?: false;
  contact_email?: null;
};

/**
 * Removes a clinic's member login: deletes the linked auth user (its profile
 * row cascades), then applies the requested reset to the retained clinic row.
 * Requires the service-role client.
 */
export async function revokeClinicAccess(
  adminClient: SupabaseClient,
  clinicId: string,
  { unpublish, clearContactEmail }: RevokeAccessOptions,
): Promise<void> {
  const { data: profile } = await adminClient
    .from('profiles')
    .select('user_id')
    .eq('clinic_id', clinicId)
    .maybeSingle();
  if (profile?.user_id) {
    const { error } = await adminClient.auth.admin.deleteUser(profile.user_id);
    if (error) throw new Error(error.message);
  }
  const update: ClinicAccessUpdate = {};
  if (unpublish) update.is_published = false;
  if (clearContactEmail) update.contact_email = null;
  if (Object.keys(update).length === 0) return;
  const { error } = await adminClient.from('clinics').update(update).eq('id', clinicId);
  if (error) throw new Error(error.message);
}
