import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['email', 'magiclink', 'invite']),
});

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = paramsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) redirect('/login?error=1');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) redirect('/login?error=1');
  const { data: profile } = await supabase.from('profiles').select('role').maybeSingle();
  redirect(profile?.role === 'admin' ? '/admin' : '/clinic');
}
