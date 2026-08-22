import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANDING, type Branding } from '@/lib/branding/branding';

import {
  buttonsHtml,
  escapeHtml,
  footerLinksHtml,
  headerHtml,
  pageHtml,
  siteBase,
  themeFrom,
  type EmailButton,
} from './layout';

const THEME = themeFrom(DEFAULT_BRANDING);

function themeWith(overrides: Partial<Branding>) {
  return themeFrom({ ...DEFAULT_BRANDING, ...overrides } as Branding);
}

describe(escapeHtml.name, () => {
  it('escapes the five characters that break out of markup or an attribute', () => {
    expect(escapeHtml(`<a href="x" data-y='z'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; data-y=&#39;z&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('escapes an ampersand before the entities it introduces', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe(themeFrom.name, () => {
  it('splits a multi-word wordmark onto two lowercase lines', () => {
    const theme = themeWith({ wordmark: 'Law Clinics Deutschland' });
    expect([theme.top, theme.bottom]).toEqual(['law clinics', 'deutschland']);
  });

  it('leaves the second line empty for a single-word wordmark', () => {
    expect(themeWith({ wordmark: 'Rechtsberatung' }).bottom).toBe('');
  });

  it('escapes markup in an admin-controlled wordmark', () => {
    expect(themeWith({ wordmark: '<b>a b' }).top).toBe('&lt;b&gt;a');
  });

  it('rejects a colour that is not a six-digit hex value', () => {
    const theme = themeWith({ color_primary: 'red; background:url(x)' });
    expect(theme.primary).toBe(DEFAULT_BRANDING.color_primary);
  });

  it('keeps a valid branding colour', () => {
    expect(themeWith({ color_primary: '#123abc' }).primary).toBe('#123abc');
  });

  it('rejects a font that is not in the branding enum', () => {
    /** The cast models stored branding that no longer matches the current font enum. */
    const theme = themeFrom({
      ...DEFAULT_BRANDING,
      font: "x'; background:url(y)",
    } as unknown as Branding);
    expect(theme.font).not.toContain('background:url(y)');
  });

  it('quotes a known non-default font ahead of the fallback stack', () => {
    expect(themeWith({ font: 'Inter' }).font.startsWith("'Inter', ")).toBe(true);
  });

  it('drops a logo URL that is not https', () => {
    expect(themeWith({ logo_url: 'javascript:alert(1)' }).logo).toBeNull();
  });
});

describe(siteBase.name, () => {
  it('strips trailing slashes so callers can append a path', () => {
    expect(siteBase('https://example.test///')).toBe('https://example.test');
  });
});

describe(headerHtml.name, () => {
  it('renders the wordmark without a brand bar by default', () => {
    expect(headerHtml(THEME)).not.toContain('height:50px');
  });

  it('renders the brand bar when it is requested', () => {
    expect(headerHtml(THEME, { bar: true })).toContain('height:50px');
  });

  it('escapes a header label', () => {
    expect(headerHtml(THEME, { label: '<b>ADMIN' })).toContain('&lt;b&gt;ADMIN');
  });
});

describe(buttonsHtml.name, () => {
  const button: EmailButton = {
    label: 'Öffnen',
    href: 'https://example.test/a?b=1&c=2',
    variant: 'primary',
  };

  it('escapes the ampersands of an href', () => {
    expect(buttonsHtml(THEME, [button], 'left')).toContain(
      'href="https://example.test/a?b=1&amp;c=2"',
    );
  });

  it('fills the primary button cell with the branding colour', () => {
    expect(buttonsHtml(THEME, [button], 'left')).toContain(`bgcolor="${THEME.primary}"`);
  });

  it('outlines the secondary button on a white cell', () => {
    const html = buttonsHtml(THEME, [{ ...button, variant: 'secondary' }], 'left');
    expect(html).toContain('border:1px solid #cfd8da;');
  });
});

describe(footerLinksHtml.name, () => {
  it('builds both legal links from the passed base URL', () => {
    const html = footerLinksHtml(THEME, 'https://other.test');
    expect([...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])).toEqual([
      'https://other.test/impressum',
      'https://other.test/datenschutz',
    ]);
  });
});

describe(pageHtml.name, () => {
  it('wraps the body in the centred card on the branding background', () => {
    const html = pageHtml(THEME, '<span>body</span>');
    expect(html).toContain('max-width:600px');
    expect(html).toContain('<span>body</span>');
  });

  it('lays out with presentation tables only', () => {
    expect(pageHtml(THEME, '').includes('<table role="presentation"')).toBe(true);
  });
});
