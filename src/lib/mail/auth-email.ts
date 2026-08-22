import { BRANDING_FONTS, DEFAULT_BRANDING, type Branding } from '@/lib/branding/branding';

export type AuthEmailPurpose = 'login' | 'invite' | 'email_change';

export type AuthEmailInput = {
  purpose: AuthEmailPurpose;
  link: string;
  branding: Branding;
  siteUrl: string;
};

export type AuthEmailMessage = { subject: string; text: string; html: string };

type Copy = {
  subject: string;
  heading: string;
  body: string;
  button: string;
  notice: string | null;
  validity: string;
  ignore: string;
};

const VALIDITY_ONCE = 'Der Link ist 15 Minuten gültig und nur einmal verwendbar.';

const COPY: Record<AuthEmailPurpose, Copy> = {
  login: {
    subject: 'Dein Anmeldelink',
    heading: 'Dein Anmeldelink',
    body: 'Klicke auf den Link um dich beim Law Clinic Finder passwortlos anmelden zu können.',
    button: 'Jetzt anmelden',
    notice: null,
    validity: VALIDITY_ONCE,
    ignore: 'Du hast keine Anmeldung angefordert? Dann kannst du diese E-Mail ignorieren.',
  },
  invite: {
    subject: 'Einladung zum Law Clinic Finder',
    heading: 'Einladung zum Law Clinic Finder',
    body: 'Du wurdest zum Law Clinic Finder eingeladen. Klicke auf den Link um dich passwortlos anmelden zu können.',
    button: 'Einladung annehmen',
    notice: null,
    validity: VALIDITY_ONCE,
    ignore: 'Du hast keine Einladung erwartet? Dann kannst du diese E-Mail ignorieren.',
  },
  email_change: {
    subject: 'Neue Admin-E-Mail-Adresse bestätigen',
    heading: 'Neue E-Mail-Adresse bestätigen',
    body: 'Bestätige diese Adresse für deinen Admin-Zugang.',
    button: 'Adresse bestätigen',
    notice: 'Nach der Änderung wird die bisherige Adresse aus Sicherheitsgründen informiert.',
    validity: 'Der Link ist 15 Minuten gültig.',
    ignore: 'Du hast keine Änderung angefordert? Dann kannst du diese E-Mail ignorieren.',
  },
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** Literal grey rather than an alpha value — e-mail clients drop rgba() on text. */
const MUTED = '#94a3a8';
const FONT_FALLBACKS =
  "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TABLE = 'role="presentation" border="0" cellpadding="0" cellspacing="0"';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Entity escaping does not protect a style attribute, so unknown values are rejected outright. */
function safeColor(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value : fallback;
}

function fontFamily(font: string): string {
  const known = (BRANDING_FONTS as readonly string[]).includes(font);
  if (!known || font === DEFAULT_BRANDING.font) return FONT_FALLBACKS;
  return `'${font}', ${FONT_FALLBACKS}`;
}

function logoSource(url: string | null): string | null {
  return url && url.startsWith('https://') ? escapeHtml(url) : null;
}

function wordmarkLines(wordmark: string): { top: string; bottom: string } {
  const words = wordmark.trim().toLowerCase().split(/\s+/);
  if (words.length < 2) return { top: escapeHtml(words.join(' ')), bottom: '' };
  return {
    top: escapeHtml(words.slice(0, -1).join(' ')),
    bottom: escapeHtml(words[words.length - 1]),
  };
}

type Theme = {
  primary: string;
  background: string;
  accent: string;
  foreground: string;
  font: string;
  logo: string | null;
  alt: string;
  top: string;
  bottom: string;
};

function themeFrom(branding: Branding): Theme {
  const lines = wordmarkLines(branding.wordmark);
  return {
    primary: safeColor(branding.color_primary, DEFAULT_BRANDING.color_primary),
    background: safeColor(branding.color_background, DEFAULT_BRANDING.color_background),
    accent: safeColor(branding.color_accent, DEFAULT_BRANDING.color_accent),
    foreground: safeColor(branding.color_foreground, DEFAULT_BRANDING.color_foreground),
    font: fontFamily(branding.font),
    logo: logoSource(branding.logo_url),
    alt: escapeHtml(branding.wordmark),
    top: lines.top,
    bottom: lines.bottom,
  };
}

function textLogoHtml(theme: Theme): string {
  const bottom = theme.bottom
    ? `<div style="font-size:14px;font-weight:600;line-height:1.3;color:${theme.primary};">${theme.bottom}</div>`
    : '';
  return [
    `<table ${TABLE}><tr>`,
    `<td align="left" valign="middle" style="padding-right:12px;font-family:${theme.font};">`,
    `<div style="font-size:22px;font-weight:800;line-height:1.15;color:${theme.primary};">${theme.top}</div>`,
    bottom,
    '</td>',
    `<td width="8" height="50" valign="middle" bgcolor="${theme.primary}" style="width:8px;height:50px;background-color:${theme.primary};font-size:0;line-height:0;">&nbsp;</td>`,
    '</tr></table>',
  ].join('');
}

function headerHtml(theme: Theme): string {
  if (!theme.logo) return textLogoHtml(theme);
  return `<img src="${theme.logo}" alt="${theme.alt}" style="display:block;max-height:40px;border:0;outline:none;text-decoration:none;" />`;
}

/** A character glyph, not SVG or a remote image — Gmail strips both. */
function badgeHtml(theme: Theme): string {
  return [
    `<table ${TABLE} align="center" style="margin:32px auto 0;"><tr>`,
    `<td align="center" valign="middle" width="112" height="112" bgcolor="${theme.accent}"`,
    ` style="width:112px;height:112px;background-color:${theme.accent};border-radius:56px;`,
    `font-family:${theme.font};font-size:30px;line-height:112px;color:${theme.primary};">&#10022;</td>`,
    '</tr></table>',
  ].join('');
}

function messageHtml(copy: Copy, theme: Theme): string {
  const notice = copy.notice
    ? `<div style="margin:16px auto 0;max-width:440px;font-size:15px;line-height:1.55;color:${theme.foreground};text-align:center;">${copy.notice}</div>`
    : '';
  return [
    `<div style="margin:24px 0 0;font-size:32px;font-weight:700;line-height:1.25;color:${theme.primary};text-align:center;">${copy.heading}</div>`,
    `<div style="margin:20px auto 0;max-width:440px;font-size:18px;line-height:1.55;color:${theme.foreground};text-align:center;">${copy.body}</div>`,
    notice,
  ].join('');
}

function buttonHtml(copy: Copy, theme: Theme, href: string): string {
  return [
    `<table ${TABLE} align="center" style="margin:32px auto 0;"><tr>`,
    `<td align="center" bgcolor="${theme.primary}" style="background-color:${theme.primary};border-radius:12px;">`,
    `<a href="${href}" style="display:inline-block;padding:18px 40px;font-family:${theme.font};`,
    'font-size:17px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;">',
    `${copy.button}</a>`,
    '</td></tr></table>',
  ].join('');
}

function finePrintHtml(copy: Copy): string {
  return [
    `<div style="margin:48px auto 0;max-width:420px;font-size:14px;line-height:1.7;color:${MUTED};text-align:center;">`,
    `${copy.validity}<br />${copy.ignore}`,
    '</div>',
  ].join('');
}

function footerHtml(theme: Theme, siteUrl: string): string {
  const link = `font-size:14px;line-height:1.6;color:${theme.primary};text-decoration:none;padding:0 18px;`;
  return [
    `<table ${TABLE} width="100%" style="width:100%;margin:32px 0 0;"><tr>`,
    `<td height="1" bgcolor="${theme.accent}" style="height:1px;background-color:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>`,
    '</tr></table>',
    '<div style="margin:24px 0 0;text-align:center;">',
    `<a href="${siteUrl}/impressum" style="${link}">Impressum</a>`,
    `<a href="${siteUrl}/datenschutz" style="${link}">Datenschutz</a>`,
    '</div>',
  ].join('');
}

function cardHtml(copy: Copy, theme: Theme, href: string, siteUrl: string): string {
  return [
    `<table ${TABLE} width="600" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:24px;"><tr>`,
    `<td style="padding:40px;font-family:${theme.font};color:${theme.foreground};">`,
    headerHtml(theme),
    badgeHtml(theme),
    messageHtml(copy, theme),
    buttonHtml(copy, theme, href),
    finePrintHtml(copy),
    footerHtml(theme, siteUrl),
    '</td></tr></table>',
  ].join('');
}

function pageHtml(copy: Copy, theme: Theme, href: string, siteUrl: string): string {
  return [
    `<table ${TABLE} width="100%" style="width:100%;background-color:${theme.background};">`,
    `<tr><td align="center" bgcolor="${theme.background}" style="padding:32px 16px;background-color:${theme.background};">`,
    cardHtml(copy, theme, href, siteUrl),
    '</td></tr></table>',
  ].join('');
}

function textBody(copy: Copy, link: string): string {
  const notice = copy.notice ? `${copy.notice}\n` : '';
  return `${copy.heading}\n\n${copy.body}\n\n${link}\n\n${notice}${copy.validity}\n${copy.ignore}\n`;
}

export function renderAuthEmail(input: AuthEmailInput): AuthEmailMessage {
  const copy = COPY[input.purpose];
  const theme = themeFrom(input.branding);
  const siteUrl = escapeHtml(input.siteUrl.replace(/\/+$/, ''));
  return {
    subject: copy.subject,
    text: textBody(copy, input.link),
    html: pageHtml(copy, theme, escapeHtml(input.link), siteUrl),
  };
}
