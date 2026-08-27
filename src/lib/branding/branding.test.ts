import { describe, expect, it } from 'vitest';

import { BRANDING_FONTS, brandingCssVars, brandingFontFaces, DEFAULT_BRANDING } from './branding';

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

describe(brandingFontFaces, () => {
  it('adds no faces for the default font, which the layout already self-hosts', () => {
    expect(brandingFontFaces(DEFAULT_BRANDING.font)).toBeNull();
  });

  it('serves a chosen font from this origin rather than from Google', () => {
    const faces = brandingFontFaces('Work Sans');
    expect(faces).toContain("src:url('/fonts/work-sans/");
    expect(faces).not.toContain('gstatic');
  });

  /* The whole point of vendoring: no request leaves the visitor's browser for
     a Google host before the page has drawn anything. */
  it('names no external host in any family it can emit', () => {
    const emitted = BRANDING_FONTS.map(brandingFontFaces).join('');
    expect(emitted).not.toMatch(/https?:\/\//);
  });

  it('covers every selectable font except the default', () => {
    const missing = BRANDING_FONTS.filter(
      (font) => font !== DEFAULT_BRANDING.font && brandingFontFaces(font) === null,
    );
    expect(missing).toEqual([]);
  });

  it('carries both the regular and the bold weight, so bold is not synthesised', () => {
    const faces = brandingFontFaces('Inter') ?? '';
    expect(faces).toContain('font-weight:400');
    expect(faces).toContain('font-weight:700');
  });

  it('returns null for a family that is not on the list', () => {
    expect(brandingFontFaces('Comic Sans MS')).toBeNull();
  });
});
