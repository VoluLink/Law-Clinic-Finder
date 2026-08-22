import type { Branding } from '@/lib/branding/branding';

import {
  buttonsHtml,
  footerLinksHtml,
  headerHtml,
  MUTED,
  pageHtml,
  siteBase,
  TABLE,
  themeFrom,
  type EmailButton,
  type Theme,
} from './layout';

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

function finePrintHtml(copy: Copy): string {
  return [
    `<div style="margin:48px auto 0;max-width:420px;font-size:14px;line-height:1.7;color:${MUTED};text-align:center;">`,
    `${copy.validity}<br />${copy.ignore}`,
    '</div>',
  ].join('');
}

function textBody(copy: Copy, link: string): string {
  const notice = copy.notice ? `${copy.notice}\n` : '';
  return `${copy.heading}\n\n${copy.body}\n\n${link}\n\n${notice}${copy.validity}\n${copy.ignore}\n`;
}

export function renderAuthEmail(input: AuthEmailInput): AuthEmailMessage {
  const copy = COPY[input.purpose];
  const theme = themeFrom(input.branding);
  const button: EmailButton = { label: copy.button, href: input.link, variant: 'hero' };
  const body = [
    headerHtml(theme, { bar: true }),
    badgeHtml(theme),
    messageHtml(copy, theme),
    buttonsHtml(theme, [button], 'center'),
    finePrintHtml(copy),
    footerLinksHtml(theme, siteBase(input.siteUrl)),
  ].join('');
  return {
    subject: copy.subject,
    text: textBody(copy, input.link),
    html: pageHtml(theme, body),
  };
}
