import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANDING, type Branding } from '@/lib/branding/branding';

import { renderAuthEmail, type AuthEmailPurpose } from './auth-email';

const SITE_URL = 'https://law-clinics.example';
const LINK = `${SITE_URL}/auth/confirm#oobCode=generated-action-code&state=${'A'.repeat(43)}&flow=email-change`;

function render(purpose: AuthEmailPurpose, branding: Branding = DEFAULT_BRANDING) {
  return renderAuthEmail({ purpose, link: LINK, branding, siteUrl: SITE_URL });
}

/** Reverses the escaping applied to attribute values. */
function unescape(value: string): string {
  return value
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function hrefsIn(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

describe(renderAuthEmail.name, () => {
  it('uses the login subject for the login purpose', () => {
    expect(render('login').subject).toBe('Dein Anmeldelink');
  });

  it('uses the invitation subject for the invite purpose', () => {
    expect(render('invite').subject).toBe('Einladung zum Law Clinic Finder');
  });

  it('uses the address-change subject for the email_change purpose', () => {
    expect(render('email_change').subject).toBe('Neue Admin-E-Mail-Adresse bestätigen');
  });

  it.each([
    ['login', 'Dein Anmeldelink', 'Jetzt anmelden'],
    ['invite', 'Einladung zum Law Clinic Finder', 'Einladung annehmen'],
    ['email_change', 'Neue E-Mail-Adresse bestätigen', 'Adresse bestätigen'],
  ] as const)('renders the %s heading and button', (purpose, heading, button) => {
    const html = render(purpose).html;
    expect(html).toContain(heading);
    expect(html).toContain(button);
  });

  it('keeps subjects on a single line', () => {
    const subjects = (['login', 'invite', 'email_change'] as const).map((p) => render(p).subject);
    expect(subjects.every((subject) => !/[\r\n]/.test(subject))).toBe(true);
  });

  it('keeps the address-change security notice', () => {
    const message = render('email_change');
    const notice =
      'Nach der Änderung wird die bisherige Adresse aus Sicherheitsgründen informiert.';
    expect(message.html).toContain(notice);
    expect(message.text).toContain(notice);
  });

  it('puts the bare link on its own line in the text alternative', () => {
    expect(render('login').text.split('\n')).toContain(LINK);
  });

  it('escapes the ampersands of the link inside the href', () => {
    const html = render('login').html;
    expect(html).toContain(`href="${LINK.replaceAll('&', '&amp;')}"`);
  });

  it('restores the link fragment byte-for-byte when the href is unescaped', () => {
    const [href] = hrefsIn(render('email_change').html);
    expect(unescape(href)).toBe(LINK);
  });

  it('escapes markup in an admin-controlled wordmark', () => {
    const html = render('login', {
      ...DEFAULT_BRANDING,
      wordmark: '<script>alert(1)</script>',
    }).html;
    expect(html).not.toContain('<script');
  });

  it('escapes ampersands and quotes in an admin-controlled wordmark', () => {
    const html = render('login', { ...DEFAULT_BRANDING, wordmark: '"Recht & Co' }).html;
    expect(html).toContain('&quot;recht &amp;');
    expect(html).not.toContain('"Recht & Co');
  });

  it('falls back to the default colour when branding carries an invalid one', () => {
    const branding = { ...DEFAULT_BRANDING, color_primary: 'red; background:url(x)' } as Branding;
    const html = render('login', branding).html;
    expect(html).not.toContain('red; background');
    expect(html).toContain(DEFAULT_BRANDING.color_primary);
  });

  it('falls back to the default font when branding carries an unknown one', () => {
    /** The cast models stored branding that no longer matches the current font enum. */
    const branding = { ...DEFAULT_BRANDING, font: "x'; background:url(y)" } as unknown as Branding;
    expect(render('login', branding).html).not.toContain('background:url(y)');
  });

  it('always returns a non-empty text alternative', () => {
    const texts = (['login', 'invite', 'email_change'] as const).map((p) => render(p).text);
    expect(texts.every((text) => text.trim().length > 0)).toBe(true);
  });

  it('names the validity and the ignore notice in the text alternative', () => {
    const text = render('login').text;
    expect(text).toContain('Der Link ist 15 Minuten gültig und nur einmal verwendbar.');
    expect(text).toContain('Du hast keine Anmeldung angefordert?');
  });

  it('points the footer links at the site imprint and privacy pages', () => {
    expect(hrefsIn(render('login').html)).toEqual(
      expect.arrayContaining([`${SITE_URL}/impressum`, `${SITE_URL}/datenschutz`]),
    );
  });

  it('embeds no script tag', () => {
    expect(render('invite').html).not.toContain('<script');
  });

  it('loads no remote asset when no logo is configured', () => {
    expect(render('login').html).not.toContain('<img');
  });

  it('renders the configured logo as the only remote asset', () => {
    const logoUrl = 'https://cdn.example/logo.png';
    const html = render('login', { ...DEFAULT_BRANDING, logo_url: logoUrl }).html;
    expect([...html.matchAll(/src="([^"]*)"/g)].map((match) => match[1])).toEqual([logoUrl]);
  });

  it('ignores a logo URL that is not https', () => {
    const branding = { ...DEFAULT_BRANDING, logo_url: 'javascript:alert(1)' } as Branding;
    expect(render('login', branding).html).not.toContain('<img');
  });
});
