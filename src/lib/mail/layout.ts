import { BRANDING_FONTS, DEFAULT_BRANDING, type Branding } from '@/lib/branding/branding';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** Literal grey rather than an alpha value — e-mail clients drop rgba() on text. */
export const MUTED = '#94a3a8';
/** Literal border grey for the same reason. */
const OUTLINE = '#cfd8da';
const FONT_FALLBACKS =
  "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const TABLE = 'role="presentation" border="0" cellpadding="0" cellspacing="0"';

export function escapeHtml(value: string): string {
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

export type Theme = {
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

export function themeFrom(branding: Branding): Theme {
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

/** Trailing slashes are stripped so callers append their own path. Unescaped — the text part needs it raw. */
export function siteBase(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

function textLogoHtml(theme: Theme, bar: boolean): string {
  const bottom = theme.bottom
    ? `<div style="font-size:14px;font-weight:600;line-height:1.3;color:${theme.primary};">${theme.bottom}</div>`
    : '';
  const barCell = bar
    ? `<td width="8" height="50" valign="middle" bgcolor="${theme.primary}" style="width:8px;height:50px;background-color:${theme.primary};font-size:0;line-height:0;">&nbsp;</td>`
    : '';
  return [
    `<table ${TABLE}><tr>`,
    `<td align="left" valign="middle" style="padding-right:12px;font-family:${theme.font};">`,
    `<div style="font-size:22px;font-weight:800;line-height:1.15;color:${theme.primary};">${theme.top}</div>`,
    bottom,
    '</td>',
    barCell,
    '</tr></table>',
  ].join('');
}

function brandMarkHtml(theme: Theme, bar: boolean): string {
  if (!theme.logo) return textLogoHtml(theme, bar);
  return `<img src="${theme.logo}" alt="${theme.alt}" style="display:block;max-height:40px;border:0;outline:none;text-decoration:none;" />`;
}

export type HeaderOptions = { bar?: boolean; label?: string };

export function headerHtml(theme: Theme, options: HeaderOptions = {}): string {
  const mark = brandMarkHtml(theme, options.bar ?? false);
  if (!options.label) return mark;
  return [
    `<table ${TABLE} width="100%" style="width:100%;"><tr>`,
    '<td align="left" valign="middle">',
    mark,
    '</td>',
    `<td align="right" valign="middle" style="font-family:${theme.font};font-size:13px;font-weight:600;`,
    `letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">`,
    escapeHtml(options.label),
    '</td></tr></table>',
  ].join('');
}

export function dividerHtml(theme: Theme, margin: string): string {
  return [
    `<table ${TABLE} width="100%" style="width:100%;margin:${margin};"><tr>`,
    `<td height="1" bgcolor="${theme.accent}" style="height:1px;background-color:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>`,
    '</tr></table>',
  ].join('');
}

export type ButtonVariant = 'hero' | 'primary' | 'secondary';
export type EmailButton = { label: string; href: string; variant: ButtonVariant };

const BUTTON_VARIANTS: Record<ButtonVariant, { padding: string; filled: boolean }> = {
  hero: { padding: '18px 40px', filled: true },
  primary: { padding: '16px 28px', filled: true },
  secondary: { padding: '16px 28px', filled: false },
};

/** A table cell rather than a styled anchor — Outlook drops the background of an inline-block link. */
function buttonCellHtml(theme: Theme, button: EmailButton): string {
  const { padding, filled } = BUTTON_VARIANTS[button.variant];
  const background = filled ? theme.primary : '#ffffff';
  const border = filled ? '' : `border:1px solid ${OUTLINE};`;
  const color = filled ? '#ffffff' : theme.primary;
  return [
    `<td align="center" bgcolor="${background}" style="background-color:${background};${border}border-radius:12px;">`,
    `<a href="${escapeHtml(button.href)}" style="display:inline-block;padding:${padding};font-family:${theme.font};`,
    `font-size:17px;font-weight:700;line-height:1.2;color:${color};text-decoration:none;border-radius:12px;">`,
    `${escapeHtml(button.label)}</a>`,
    '</td>',
  ].join('');
}

export function buttonsHtml(
  theme: Theme,
  buttons: readonly EmailButton[],
  align: 'left' | 'center',
): string {
  const margin = align === 'center' ? '32px auto 0' : '32px 0 0';
  const gap = '<td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>';
  const cells = buttons.map((button) => buttonCellHtml(theme, button)).join(gap);
  return `<table ${TABLE} align="${align}" style="margin:${margin};"><tr>${cells}</tr></table>`;
}

export function footerLinksHtml(theme: Theme, base: string): string {
  const link = `font-size:14px;line-height:1.6;color:${theme.primary};text-decoration:none;padding:0 18px;`;
  const href = escapeHtml(base);
  return [
    dividerHtml(theme, '32px 0 0'),
    '<div style="margin:24px 0 0;text-align:center;">',
    `<a href="${href}/impressum" style="${link}">Impressum</a>`,
    `<a href="${href}/datenschutz" style="${link}">Datenschutz</a>`,
    '</div>',
  ].join('');
}

function cardHtml(theme: Theme, body: string): string {
  return [
    `<table ${TABLE} width="600" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:24px;"><tr>`,
    `<td style="padding:40px;font-family:${theme.font};color:${theme.foreground};">`,
    body,
    '</td></tr></table>',
  ].join('');
}

export function pageHtml(theme: Theme, body: string): string {
  return [
    `<table ${TABLE} width="100%" style="width:100%;background-color:${theme.background};">`,
    `<tr><td align="center" bgcolor="${theme.background}" style="padding:32px 16px;background-color:${theme.background};">`,
    cardHtml(theme, body),
    '</td></tr></table>',
  ].join('');
}
