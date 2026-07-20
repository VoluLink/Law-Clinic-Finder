import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
