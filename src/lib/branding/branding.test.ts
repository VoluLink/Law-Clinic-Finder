import { describe, expect, it } from 'vitest';

import { brandingCssVars, DEFAULT_BRANDING, googleFontHref } from './branding';

describe(brandingCssVars, () => {
  it('overrides the four themeable tokens', () => {
    const css = brandingCssVars({ ...DEFAULT_BRANDING, color_primary: '#123456' });
    expect(css).toContain('--primary:#123456;');
    expect(css).toContain('--background:#faf2e7;');
  });

  it('adds a font override only for a non-default font', () => {
    expect(brandingCssVars(DEFAULT_BRANDING)).not.toContain('--font-brand');
    expect(brandingCssVars({ ...DEFAULT_BRANDING, font: 'Inter' })).toContain(
      "--font-brand:'Inter';",
    );
  });
});

describe(googleFontHref, () => {
  it('returns null for the default font', () => {
    expect(googleFontHref('Hanken Grotesk')).toBeNull();
  });

  it('builds a plus-encoded Google Fonts URL for a chosen font', () => {
    expect(googleFontHref('Work Sans')).toBe(
      'https://fonts.googleapis.com/css2?family=Work+Sans&display=swap',
    );
  });
});
