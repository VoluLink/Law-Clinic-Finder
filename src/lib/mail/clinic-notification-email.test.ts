import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANDING, type Branding } from '@/lib/branding/branding';

import {
  renderClinicPublishedEmail,
  renderClinicSubmissionEmail,
  type ClinicPublishedInput,
  type ClinicSubmissionInput,
} from './clinic-notification-email';

const SITE_URL = 'https://law-clinics.example';
const OTHER_SITE_URL = 'https://neue-domain.example';
const HOSTILE_NAME = `<script>alert("x")</script> Recht & Co`;
const SUBMITTED_AT = new Date(2026, 7, 22, 12, 0, 0);

function submission(overrides: Partial<ClinicSubmissionInput['clinic']> = {}, siteUrl = SITE_URL) {
  return renderClinicSubmissionEmail({
    branding: DEFAULT_BRANDING,
    siteUrl,
    clinic: {
      id: 'clinic-1',
      name: 'Law Clinic Hamburg',
      contactEmail: 'kontakt@clinic.example',
      submittedAt: SUBMITTED_AT,
      ...overrides,
    },
  });
}

function published(overrides: Partial<ClinicPublishedInput['clinic']> = {}, siteUrl = SITE_URL) {
  return renderClinicPublishedEmail({
    branding: DEFAULT_BRANDING,
    siteUrl,
    clinic: {
      name: 'Law Clinic Hamburg',
      contactEmail: 'kontakt@clinic.example',
      legalAreas: 'Mietrecht, Sozialrecht',
      ...overrides,
    },
  });
}

function hrefsIn(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

describe(renderClinicSubmissionEmail.name, () => {
  it('announces the pending release in the subject', () => {
    expect(submission().subject).toBe('Ein neuer Eintrag wartet auf deine Freigabe');
  });

  it('keeps the subject on a single line', () => {
    expect(/[\r\n]/.test(submission().subject)).toBe(false);
  });

  it('marks the amber waiting eyebrow', () => {
    expect(submission().html).toMatch(/color:#b26a1f;[^"]*">&#9679;&nbsp;Warten auf Freigabe/);
  });

  it('labels the header as the admin dashboard', () => {
    expect(submission().html).toContain('ADMIN-DASHBOARD');
  });

  it('links the word Einstellungen to the admin accounts page', () => {
    expect(submission().html).toContain(
      `<a href="${SITE_URL}/admin/admins" style="font-weight:700;color:${DEFAULT_BRANDING.color_primary};text-decoration:underline;">Einstellungen</a>`,
    );
  });

  it('deep-links the review button to the submitted clinic', () => {
    expect(hrefsIn(submission().html)).toContain(`${SITE_URL}/admin/clinics?clinic=clinic-1`);
  });

  it('encodes a clinic id that carries URL syntax', () => {
    const html = submission({ id: 'a b&c=d' }).html;
    expect(hrefsIn(html)).toContain(`${SITE_URL}/admin/clinics?clinic=a%20b%26c%3Dd`);
  });

  it('shows the contact address and the submission date in the meta line', () => {
    expect(submission().html).toContain('kontakt@clinic.example · 22.08.2026');
  });

  it('shows only the date when the clinic has no contact address', () => {
    const message = submission({ contactEmail: null });
    expect(message.html).toContain('22.08.2026');
    expect(message.html).not.toContain('· 22.08.2026');
  });

  it('escapes a hostile clinic name in the HTML part', () => {
    const html = submission({ name: HOSTILE_NAME }).html;
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Recht &amp; Co');
  });

  it('keeps a hostile clinic name literal in the text part', () => {
    expect(submission({ name: HOSTILE_NAME }).text).toContain(HOSTILE_NAME);
  });

  it('rebuilds every link from a swapped site URL', () => {
    const hrefs = hrefsIn(submission({}, OTHER_SITE_URL).html);
    expect(hrefs.length).toBe(3);
    expect(hrefs.every((href) => href.startsWith(OTHER_SITE_URL))).toBe(true);
  });

  it('lists the bare action URLs in the text part', () => {
    const text = submission().text;
    expect(text).toContain(`${SITE_URL}/admin/clinics?clinic=clinic-1`);
    expect(text).toContain(`${SITE_URL}/admin`);
  });

  it('repeats heading, paragraphs and clinic name in a non-empty text part', () => {
    const text = submission().text;
    expect(text.startsWith('Ein neuer Eintrag wartet auf deine Freigabe')).toBe(true);
    expect(text).toContain('Bis dahin bleibt der Eintrag unsichtbar.');
    expect(text).toContain('Law Clinic Hamburg');
  });

  it('embeds no script tag', () => {
    expect(submission({ name: HOSTILE_NAME }).html).not.toContain('<script');
  });

  it('loads no remote image', () => {
    expect(submission().html).not.toContain('<img');
  });

  it('keeps an invalid branding colour out of the style attributes', () => {
    const branding = { ...DEFAULT_BRANDING, color_primary: 'red; background:url(x)' } as Branding;
    const html = renderClinicSubmissionEmail({
      branding,
      siteUrl: SITE_URL,
      clinic: { id: 'a', name: 'b', contactEmail: null, submittedAt: SUBMITTED_AT },
    }).html;
    expect(html).not.toContain('red; background');
  });
});

describe(renderClinicPublishedEmail.name, () => {
  it('announces the release in the subject', () => {
    expect(published().subject).toBe('Euer Eintrag ist freigegeben');
  });

  it('keeps the subject on a single line', () => {
    expect(/[\r\n]/.test(published().subject)).toBe(false);
  });

  it('marks the green online eyebrow', () => {
    expect(published().html).toMatch(/color:#2f7a52;[^"]*">&#9679;&nbsp;Jetzt online/);
  });

  it('labels the header with the product name', () => {
    expect(published().html).toContain('LAW CLINIC FINDER');
  });

  it('greets the clinic by name in the first paragraph', () => {
    expect(published().text).toContain(
      'Hallo Law Clinic Hamburg, eure Angaben wurden geprüft und veröffentlicht.',
    );
  });

  it('labels the info card with the visitor perspective', () => {
    expect(published().html).toContain('SO SEHEN RATSUCHENDE EUCH');
  });

  it('joins the contact address and the legal areas in the meta line', () => {
    expect(published().html).toContain('kontakt@clinic.example · Mietrecht, Sozialrecht');
  });

  it('drops the separator when the legal areas are missing', () => {
    const html = published({ legalAreas: null }).html;
    expect(html).toContain('kontakt@clinic.example');
    expect(html).not.toContain('kontakt@clinic.example ·');
  });

  it('drops the separator when the contact address is missing', () => {
    const html = published({ contactEmail: null }).html;
    expect(html).toContain('Mietrecht, Sozialrecht');
    expect(html).not.toContain('· Mietrecht');
  });

  it('escapes hostile legal areas in the HTML part', () => {
    const html = published({ legalAreas: '<img src=x onerror=alert(1)>' }).html;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes a hostile clinic name in the HTML part', () => {
    const html = published({ name: HOSTILE_NAME }).html;
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Recht &amp; Co');
  });

  it('keeps a hostile clinic name literal in the text part', () => {
    expect(published({ name: HOSTILE_NAME }).text).toContain(HOSTILE_NAME);
  });

  it('rebuilds every link from a swapped site URL', () => {
    const hrefs = hrefsIn(published({}, OTHER_SITE_URL).html);
    expect(hrefs.length).toBe(2);
    expect(hrefs.every((href) => href.startsWith(OTHER_SITE_URL))).toBe(true);
  });

  it('lists the bare action URLs in the text part', () => {
    const text = published().text;
    expect(text).toContain(`${SITE_URL}/clinic`);
    expect(text).toContain(`Eintrag ansehen: ${SITE_URL}/`);
  });

  it('repeats heading, paragraphs and clinic name in a non-empty text part', () => {
    const text = published().text;
    expect(text.startsWith('Euer Eintrag ist freigegeben')).toBe(true);
    expect(text).toContain(
      'Sie sieht dann eure Kontaktdaten und kann sich direkt bei euch melden.',
    );
    expect(text).toContain('Law Clinic Hamburg');
  });

  it('embeds no script tag', () => {
    expect(published({ name: HOSTILE_NAME }).html).not.toContain('<script');
  });

  it('carries no footer legal links', () => {
    expect(published().html).not.toContain('/impressum');
  });
});
