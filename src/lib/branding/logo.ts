import sharp from 'sharp';
import { z } from 'zod';

export const logoContentTypeSchema = z.enum(['image/png', 'image/svg+xml']);
const MAX_LOGO_PIXELS = 16_000_000;
const MAX_LOGO_DIMENSION = 2048;

export class BrandingLogoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BrandingLogoError';
  }
}

export async function normalizeLogo(input: Buffer, contentType: string): Promise<Buffer> {
  if (!logoContentTypeSchema.safeParse(contentType).success) {
    throw new BrandingLogoError('unsupported logo type');
  }
  try {
    return await sharp(input, { failOn: 'error', limitInputPixels: MAX_LOGO_PIXELS, pages: 1 })
      .resize(MAX_LOGO_DIMENSION, MAX_LOGO_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (cause) {
    throw new BrandingLogoError('invalid logo image', { cause });
  }
}
