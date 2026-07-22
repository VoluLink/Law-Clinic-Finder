import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

// Revoke a clinic's member access: delete the linked auth user (its profile row
// cascades) but keep the clinic published in the directory. Re-inviting
// re-creates both. A clinic leaving itself goes through /api/clinic/account,
// which additionally unpublishes.
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  try {
    await revokeClinicAccess(createSupabaseAdminClient(), id, { unpublish: false });
  } catch (error) {
    logger.error('clinic access revoke failed', {
      clinicId: id,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Zugang entziehen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
