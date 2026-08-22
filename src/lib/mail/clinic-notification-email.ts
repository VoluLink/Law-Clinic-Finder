import type { Branding } from '@/lib/branding/branding';

import {
  buttonsHtml,
  dividerHtml,
  escapeHtml,
  headerHtml,
  MUTED,
  pageHtml,
  siteBase,
  TABLE,
  themeFrom,
  type EmailButton,
  type Theme,
} from './layout';

export type ClinicNotificationMessage = { subject: string; text: string; html: string };

export type ClinicSubmissionInput = {
  branding: Branding;
  siteUrl: string;
  clinic: { id: string; name: string; contactEmail: string | null; submittedAt: Date };
};

export type ClinicPublishedInput = {
  branding: Branding;
  siteUrl: string;
  clinic: { name: string; contactEmail: string | null; legalAreas: string | null };
};

/** E-mail clients need literal colours in a style attribute — CSS variables and rgba() do not survive. */
const AMBER = '#b26a1f';
const GREEN = '#2f7a52';
const INFO_CARD_BACKGROUND = '#faf5ec';

/** A fixed brand monogram, never initials of the clinic name — those would leak unescaped user text. */
const AVATAR_MONOGRAM = 'LC';

const SUBMISSION_SUBJECT = 'Ein neuer Eintrag wartet auf deine Freigabe';
const PUBLISHED_SUBJECT = 'Euer Eintrag ist freigegeben';
const SUBMISSION_INTRO =
  'Eine Law Clinic hat ihre Angaben eingereicht. Du entscheidest jetzt, ob der Eintrag veröffentlicht wird: Nach der Freigabe kennt die KI die Beratungsvoraussetzungen dieser Clinic und kann sie Ratsuchenden vorschlagen. Bis dahin bleibt der Eintrag unsichtbar.';
const SETTINGS_PREFIX =
  'Du erhältst diese E-Mail, weil du als primärer Kontakt für die Website eingetragen bist. Das lässt sich jederzeit in den ';
const SETTINGS_SUFFIX = ' ändern.';
const PUBLISHED_OUTRO =
  'Wenn eine Person im Chat ihr Problem beschreibt und ihr am besten dazu passt, wird ihr eure Clinic vorgeschlagen. Sie sieht dann eure Kontaktdaten und kann sich direkt bei euch melden.';

type Paragraph = { text: string; html: string };
type Eyebrow = { label: string; color: string };
type InfoCard = { label: string | null; title: string; meta: string };
type TextLink = { label: string; href: string };

type Notification = {
  subject: string;
  headerLabel: string;
  eyebrow: Eyebrow;
  heading: string;
  paragraphs: Paragraph[];
  card: InfoCard;
  buttons: EmailButton[];
  extraLinks: TextLink[];
};

function plain(text: string): Paragraph {
  return { text, html: escapeHtml(text) };
}

function settingsParagraph(theme: Theme, href: string): Paragraph {
  const link = `<a href="${escapeHtml(href)}" style="font-weight:700;color:${theme.primary};text-decoration:underline;">Einstellungen</a>`;
  return {
    text: `${SETTINGS_PREFIX}Einstellungen${SETTINGS_SUFFIX}`,
    html: `${escapeHtml(SETTINGS_PREFIX)}${link}${escapeHtml(SETTINGS_SUFFIX)}`,
  };
}

function metaLine(parts: readonly (string | null)[]): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' · ');
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function eyebrowHtml(theme: Theme, eyebrow: Eyebrow): string {
  return [
    `<div style="margin:28px 0 0;font-family:${theme.font};font-size:15px;font-weight:700;`,
    `line-height:1.4;color:${eyebrow.color};text-align:left;">`,
    `&#9679;&nbsp;${escapeHtml(eyebrow.label)}</div>`,
  ].join('');
}

function headingHtml(theme: Theme, heading: string): string {
  return [
    `<div style="margin:12px 0 0;font-size:30px;font-weight:700;line-height:1.25;`,
    `color:${theme.primary};text-align:left;">${escapeHtml(heading)}</div>`,
  ].join('');
}

function paragraphsHtml(theme: Theme, paragraphs: readonly Paragraph[]): string {
  const style = `margin:20px 0 0;font-size:17px;line-height:1.6;color:${theme.foreground};text-align:left;`;
  return paragraphs.map((paragraph) => `<div style="${style}">${paragraph.html}</div>`).join('');
}

function avatarCellHtml(theme: Theme): string {
  return [
    `<td align="center" valign="middle" width="56" height="56" bgcolor="${theme.primary}"`,
    ` style="width:56px;height:56px;background-color:${theme.primary};border-radius:28px;`,
    `font-family:${theme.font};font-size:17px;font-weight:700;line-height:56px;color:#ffffff;">`,
    `${AVATAR_MONOGRAM}</td>`,
  ].join('');
}

function infoCardBodyHtml(theme: Theme, card: InfoCard): string {
  const label = card.label
    ? `<div style="font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(card.label)}</div>`
    : '';
  const meta = card.meta
    ? `<div style="margin:4px 0 0;font-size:15px;line-height:1.5;color:${MUTED};">${escapeHtml(card.meta)}</div>`
    : '';
  return [
    label,
    `<table ${TABLE} style="margin:${label ? '16px 0 0' : '0'};"><tr>`,
    avatarCellHtml(theme),
    `<td valign="middle" style="padding-left:16px;font-family:${theme.font};">`,
    `<div style="font-size:17px;font-weight:700;line-height:1.4;color:${theme.primary};">${escapeHtml(card.title)}</div>`,
    meta,
    '</td></tr></table>',
  ].join('');
}

function infoCardHtml(theme: Theme, card: InfoCard): string {
  return [
    `<table ${TABLE} width="100%" style="width:100%;margin:32px 0 0;background-color:${INFO_CARD_BACKGROUND};border-radius:16px;"><tr>`,
    `<td bgcolor="${INFO_CARD_BACKGROUND}" style="padding:24px;background-color:${INFO_CARD_BACKGROUND};border-radius:16px;">`,
    infoCardBodyHtml(theme, card),
    '</td></tr></table>',
  ].join('');
}

function textBody(notification: Notification): string {
  const paragraphs = notification.paragraphs.map((paragraph) => paragraph.text).join('\n\n');
  const details = [notification.card.title, notification.card.meta]
    .filter((line) => line.length > 0)
    .join('\n');
  const links = [...notification.buttons, ...notification.extraLinks]
    .map((link) => `${link.label}: ${link.href}`)
    .join('\n');
  return `${notification.heading}\n\n${paragraphs}\n\n${details}\n\n${links}\n`;
}

function renderNotification(theme: Theme, notification: Notification): ClinicNotificationMessage {
  const body = [
    headerHtml(theme, { label: notification.headerLabel }),
    dividerHtml(theme, '24px 0 0'),
    eyebrowHtml(theme, notification.eyebrow),
    headingHtml(theme, notification.heading),
    paragraphsHtml(theme, notification.paragraphs),
    infoCardHtml(theme, notification.card),
    buttonsHtml(theme, notification.buttons, 'left'),
  ].join('');
  return {
    subject: notification.subject,
    text: textBody(notification),
    html: pageHtml(theme, body),
  };
}

function submissionButtons(base: string, clinicId: string): EmailButton[] {
  return [
    {
      label: 'Eintrag prüfen und freigeben',
      href: `${base}/admin/clinics?clinic=${encodeURIComponent(clinicId)}`,
      variant: 'primary',
    },
    { label: 'Im Dashboard öffnen', href: `${base}/admin`, variant: 'secondary' },
  ];
}

export function renderClinicSubmissionEmail(
  input: ClinicSubmissionInput,
): ClinicNotificationMessage {
  const theme = themeFrom(input.branding);
  const base = siteBase(input.siteUrl);
  const settingsHref = `${base}/admin/admins`;
  const { id, name, contactEmail, submittedAt } = input.clinic;
  return renderNotification(theme, {
    subject: SUBMISSION_SUBJECT,
    headerLabel: 'ADMIN-DASHBOARD',
    eyebrow: { label: 'Warten auf Freigabe', color: AMBER },
    heading: SUBMISSION_SUBJECT,
    paragraphs: [plain(SUBMISSION_INTRO), settingsParagraph(theme, settingsHref)],
    card: { label: null, title: name, meta: metaLine([contactEmail, formatDate(submittedAt)]) },
    buttons: submissionButtons(base, id),
    extraLinks: [{ label: 'Einstellungen', href: settingsHref }],
  });
}

function publishedButtons(base: string): EmailButton[] {
  return [
    { label: 'Eintrag ansehen', href: `${base}/`, variant: 'primary' },
    { label: 'Angaben bearbeiten', href: `${base}/clinic`, variant: 'secondary' },
  ];
}

function publishedGreeting(name: string): Paragraph {
  return plain(
    `Hallo ${name}, eure Angaben wurden geprüft und veröffentlicht. Die KI kennt jetzt eure Beratungsvoraussetzungen.`,
  );
}

export function renderClinicPublishedEmail(input: ClinicPublishedInput): ClinicNotificationMessage {
  const theme = themeFrom(input.branding);
  const { name, contactEmail, legalAreas } = input.clinic;
  const card = {
    label: 'SO SEHEN RATSUCHENDE EUCH',
    title: name,
    meta: metaLine([contactEmail, legalAreas]),
  };
  return renderNotification(theme, {
    subject: PUBLISHED_SUBJECT,
    headerLabel: 'LAW CLINIC FINDER',
    eyebrow: { label: 'Jetzt online', color: GREEN },
    heading: PUBLISHED_SUBJECT,
    paragraphs: [publishedGreeting(name), plain(PUBLISHED_OUTRO)],
    card,
    buttons: publishedButtons(siteBase(input.siteUrl)),
    extraLinks: [],
  });
}
