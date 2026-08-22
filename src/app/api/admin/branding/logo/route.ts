import { requireAdminRoute } from '@/lib/auth/admin-guard';
import { BrandingLogoError, logoContentTypeSchema, normalizeLogo } from '@/lib/branding/logo';
import { firebaseBrandingRepository } from '@/lib/firebase/branding-repository';
import { requestLogger } from '@/lib/http/request-id';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function validateFile(value: FormDataEntryValue | null): File | Response {
  if (!(value instanceof File)) return Response.json({ error: 'Keine Datei.' }, { status: 400 });
  if (!logoContentTypeSchema.safeParse(value.type).success) {
    return Response.json({ error: 'Nur PNG oder SVG.' }, { status: 400 });
  }
  if (value.size === 0 || value.size > MAX_LOGO_BYTES) {
    return Response.json({ error: 'Datei zu groß oder leer (max. 2 MB).' }, { status: 400 });
  }
  return value;
}

export async function POST(request: Request): Promise<Response> {
  const logger = requestLogger(request);
  const guard = await requireAdminRoute(request);
  if ('response' in guard) return guard.response;
  const form = await request.formData().catch(() => null);
  const file = validateFile(form?.get('file') ?? null);
  if (file instanceof Response) return file;
  try {
    const normalized = await normalizeLogo(Buffer.from(await file.arrayBuffer()), file.type);
    const url = await firebaseBrandingRepository.uploadLogo(normalized);
    return Response.json({ url });
  } catch (error) {
    if (error instanceof BrandingLogoError) {
      return Response.json({ error: 'Ungültige Bilddatei.' }, { status: 400 });
    }
    logger.error('branding logo upload failed', { reason: errorMessage(error) });
    return Response.json({ error: 'Upload fehlgeschlagen.' }, { status: 500 });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}
