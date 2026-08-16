import { redirect } from 'next/navigation';

import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  // Read the id before the session goes, so the log line can be tied to the
  // matching sign-in without ever recording an address.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;
  await supabase.auth.signOut();
  logger.info('signed out', { userId });
  redirect('/login');
}
