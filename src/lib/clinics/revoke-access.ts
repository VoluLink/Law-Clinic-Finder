import type { SupabaseClient } from '@supabase/supabase-js';

export type RevokeAccessOptions = {
  /** Also hide the entry from the finder — used when a clinic leaves itself. */
  unpublish: boolean;
};

/**
 * Removes a clinic's member login: deletes the linked auth user (its profile
 * row cascades) and, when self-requested, unpublishes the directory entry so
 * the assistant stops offering it. The clinic row itself is always kept, so an
 * admin can re-invite the clinic later. Requires the service-role client.
 */
export async function revokeClinicAccess(
  adminClient: SupabaseClient,
  clinicId: string,
  { unpublish }: RevokeAccessOptions,
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
  if (unpublish) {
    const { error } = await adminClient
      .from('clinics')
      .update({ is_published: false })
      .eq('id', clinicId);
    if (error) throw new Error(error.message);
  }
}
