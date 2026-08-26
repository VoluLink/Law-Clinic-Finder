import type { NextRequest } from 'next/server';

import { linkInvitedUser, reinviteClinic } from '@/lib/admin/invite-clinic';
import { firebaseClinicClaimStore } from '@/lib/firebase/clinic-claim-store';
import { firebaseClinicInviteStore } from '@/lib/firebase/clinic-invite-store';
import { bodyRejectionResponse, readJsonBody } from '@/lib/http/body';
import { requestLogger } from '@/lib/http/request-id';
import { SIGNUP_CLAIM_RATE_LIMIT, createRateLimiter } from '@/lib/rate-limit';
import { claimClinic, signupClaimSchema, type ClaimResult } from '@/lib/signup/handle-claim';
import { guardSignupRequest, guardSignupSubject } from '@/lib/signup/route-guard';

const limiter = createRateLimiter(SIGNUP_CLAIM_RATE_LIMIT);

const RESULT_STATUS: Partial<Record<ClaimResult['status'], number>> = {
  not_found: 404,
  error: 500,
};

export async function POST(request: NextRequest): Promise<Response> {
  const logger = requestLogger(request);
  const rejected = guardSignupRequest(request, limiter, logger);
  if (rejected) return rejected;
  const body = await readJsonBody(request);
  if (!body.ok) return bodyRejectionResponse(body.reason);
  const parsed = signupClaimSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const limited = await guardSignupSubject(request, parsed.data.email, logger);
  if (limited) return limited;

  const inviteDeps = { store: firebaseClinicInviteStore, logger };
  const result = await claimClinic(
    {
      store: firebaseClinicClaimStore,
      logger,
      invite: (clinicId) => reinviteClinic(inviteDeps, clinicId),
      claimWithEmail: (clinicId, email) => linkInvitedUser(inviteDeps, clinicId, email, 'pending'),
    },
    parsed.data.clinicId,
    parsed.data.email,
  );
  return Response.json(result, { status: RESULT_STATUS[result.status] ?? 200 });
}
