import type { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { SIGNUP_SEARCH_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { searchDirectory, signupSearchSchema } from '@/lib/signup/handle-search';
import { guardSignupRequest } from '@/lib/signup/route-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const limiter = createRateLimiter(SIGNUP_SEARCH_RATE_LIMIT);

export async function POST(request: NextRequest): Promise<Response> {
  const rejected = guardSignupRequest(request, limiter);
  if (rejected) return rejected;
  const body = await request.json().catch(() => null);
  const parsed = signupSearchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const results = await searchDirectory(
    { adminClient: createSupabaseAdminClient(), logger },
    parsed.data.query,
  );
  if (!results) {
    return Response.json({ error: 'Suche derzeit nicht möglich.' }, { status: 500 });
  }
  return Response.json({ results });
}
