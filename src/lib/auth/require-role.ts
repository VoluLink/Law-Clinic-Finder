import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const profileSchema = z.object({
  role: z.enum(['admin', 'clinic']),
  clinic_id: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Second defense layer after src/proxy.ts (and before RLS): every gated
 * route/page re-checks the caller's role through this helper.
 */
export async function requireRole(
  supabase: SupabaseClient,
  allowed: Array<Profile['role']>,
): Promise<Profile> {
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new AuthError('not signed in', 401);
  const { data: profile } = await supabase.from('profiles').select('role, clinic_id').maybeSingle();
  const parsed = profileSchema.safeParse(profile);
  if (!parsed.success || !allowed.includes(parsed.data.role)) {
    throw new AuthError('insufficient role', 403);
  }
  return parsed.data;
}
