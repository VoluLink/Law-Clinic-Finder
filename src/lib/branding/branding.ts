import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

export const DEFAULT_BRANDING: Branding = {
  wordmark: 'law clinics',
  logo_url: null,
  color_primary: '#0d4b5b',
  color_background: '#faf2e7',
  color_accent: '#f0e6d2',
  color_foreground: '#3a565e',
  font: 'Hanken Grotesk',
};

export async function loadBranding(client: SupabaseClient): Promise<Branding> {
  const { data } = await client.from('branding').select('*').maybeSingle();
  const parsed = brandingSchema.safeParse(data);
  return parsed.success ? parsed.data : DEFAULT_BRANDING;
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

/** Google-Fonts stylesheet URL for a non-default font, else null. */
export function googleFontHref(font: string): string | null {
  if (
    font === DEFAULT_BRANDING.font ||
    !BRANDING_FONTS.includes(font as (typeof BRANDING_FONTS)[number])
  ) {
    return null;
  }
  return `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap`;
}
