import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { revokeClinicAccess } from '@/lib/clinics/revoke-access';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

// Reset a clinic's member access: delete the linked auth user and clear the
// contact/login email, while preserving the directory publication state.
export async function DELETE(_request: NextRequest, context: RouteContext): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }
  try {
    await revokeClinicAccess(createSupabaseAdminClient(), id, {
      unpublish: false,
      clearContactEmail: true,
    });
  } catch (error) {
    logger.error('clinic access reset failed', {
      clinicId: id,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'Zugang zurücksetzen fehlgeschlagen.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
