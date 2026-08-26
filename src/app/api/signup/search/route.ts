import type { NextRequest } from 'next/server';

import { firebaseSignupDirectory } from '@/lib/firebase/signup-directory';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { SIGNUP_SEARCH_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { searchDirectory, signupSearchSchema } from '@/lib/signup/handle-search';
import { guardSignupRequest } from '@/lib/signup/route-guard';

const limiter = createRateLimiter(SIGNUP_SEARCH_RATE_LIMIT);

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const rejected = guardSignupRequest(request, limiter, logger);
  if (rejected) return rejected;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = signupSearchSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });

  const results = await searchDirectory(
    { store: firebaseSignupDirectory, logger },
    parsed.data.query,
  );
  if (!results) {
    return Response.json({ error: 'Suche derzeit nicht möglich.' }, { status: 500 });
  }
  return Response.json({ results });
}
