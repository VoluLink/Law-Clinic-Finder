import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['email', 'magiclink', 'invite', 'email_change']),
});

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = paramsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) redirect('/login?error=1');
  const supabase = await createSupabaseServerClient();
  const { data: verified, error } = await supabase.auth.verifyOtp(parsed.data);
  if (error || !verified.user) redirect('/login?error=1');
  // Filter by user_id explicitly; RLS alone is not enough here — an admin can
  // read every profile row, so an unfiltered maybeSingle() errors on 2+ rows.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', verified.user.id)
    .maybeSingle();
  redirect(profile?.role === 'admin' ? '/admin' : '/clinic');
}
