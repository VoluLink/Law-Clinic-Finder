import { z } from 'zod';

import { BRANDING_FONT_FACES } from './font-faces';
import type { BrandingRepository } from './repository';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültige Farbe (z. B. #0d4b5b).');

/** The ~36 Google fonts the branding tab offers, plus the default. */
export const BRANDING_FONTS = [
  'Hanken Grotesk',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Work Sans',
  'Raleway',
  'Source Sans 3',
  'IBM Plex Sans',
  'DM Sans',
  'Manrope',
  'Karla',
  'Rubik',
  'Mulish',
  'Merriweather',
  'Playfair Display',
  'Lora',
  'Source Serif 4',
  'PT Serif',
  'Bitter',
  'Roboto Slab',
  'Libre Baskerville',
  'Space Grotesk',
  'Josefin Sans',
  'Quicksand',
  'Oswald',
  'Archivo',
  'Fira Sans',
  'Cabin',
  'Barlow',
] as const;

export const brandingSchema = z.object({
  wordmark: z.string().trim().min(1).max(60),
  logo_url: z.union([z.null(), z.literal(''), z.url().max(500)]).transform((v) => v || null),
  color_primary: hexColor,
  color_background: hexColor,
  color_accent: hexColor,
  color_foreground: hexColor,
  font: z.enum(BRANDING_FONTS),
});

export type Branding = z.infer<typeof brandingSchema>;
export const brandingUpdateSchema = brandingSchema.omit({ logo_url: true });
export type BrandingUpdate = z.infer<typeof brandingUpdateSchema>;

export const DEFAULT_BRANDING: Branding = {
  wordmark: 'Law Clinics Deutschland',
  logo_url: null,
  color_primary: '#0d4b5b',
  color_background: '#faf2e7',
  color_accent: '#f0e6d2',
  color_foreground: '#3a565e',
  font: 'Hanken Grotesk',
};

export async function loadBranding(repository: BrandingRepository): Promise<Branding> {
  return (await repository.read()) ?? DEFAULT_BRANDING;
}

/** Overrides the base design tokens at runtime; unset values fall back to CSS defaults. */
export function brandingCssVars(branding: Branding): string {
  const lines = [
    `--primary:${branding.color_primary};`,
    `--background:${branding.color_background};`,
    `--accent:${branding.color_accent};`,
    `--foreground:${branding.color_foreground};`,
  ];
  if (branding.font !== DEFAULT_BRANDING.font) lines.push(`--font-brand:'${branding.font}';`);
  return `:root{${lines.join('')}}`;
}

/**
 * The `@font-face` rules for a selected non-default font, else null.
 *
 * These used to be a `<link>` to `fonts.googleapis.com`, which handed every
 * visitor's IP address to Google before the page drew anything. The faces are
 * vendored under `public/fonts/` instead, and only the selected family's rules
 * are written into the page, so nothing loads the other thirty-one.
 */
export function brandingFontFaces(font: string): string | null {
  if (font === DEFAULT_BRANDING.font) return null;
  return BRANDING_FONT_FACES[font] ?? null;
}
