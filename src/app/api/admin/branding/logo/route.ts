import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { 'image/png': 'png', 'image/svg+xml': 'svg' };

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminRoute();
  if ('response' in guard) return guard.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Keine Datei.' }, { status: 400 });
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) return Response.json({ error: 'Nur PNG oder SVG.' }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) {
    return Response.json({ error: 'Datei zu groß (max. 2 MB).' }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const path = `logo-${Date.now()}.${extension}`;
  const { error } = await admin.storage
    .from('branding')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    logger.error('branding logo upload failed', { reason: error.message });
    return Response.json({ error: 'Upload fehlgeschlagen.' }, { status: 500 });
  }
  const { data } = admin.storage.from('branding').getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
