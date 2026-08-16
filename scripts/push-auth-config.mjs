// Applies the auth settings that live outside the database: the redirect allow
// list, the link lifetime, and the two mail templates in supabase/email-templates/.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=sbp_… node scripts/push-auth-config.mjs           # dry run
//   SUPABASE_ACCESS_TOKEN=sbp_… node scripts/push-auth-config.mjs --apply   # write
//
// The token is a Supabase *personal access token* (Account → Access Tokens),
// not the project's service key — the Management API accepts nothing else. It
// is read from the environment and never written to disk or printed.
//
// This sends a targeted PATCH with only the fields below. `supabase config push`
// would be the obvious alternative and is the wrong tool here: it submits the
// whole [auth] block from config.toml, so anything the file omits — SMTP
// credentials above all — gets reset to the CLI's defaults.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.supabase.com/v1/projects';

const SUBJECTS = {
  magic_link: 'Dein Anmeldelink für Law Clinics Deutschland',
  invite: 'Bestätige deine E-Mail-Adresse',
};

/** Matches the "Gültig für 15 Minuten" line in both templates. */
const OTP_EXPIRY_SECONDS = 900;

/** Every origin the emailed link may return to. Supabase silently falls back to
 *  the Site URL when a redirect is not listed here, which lands the visitor on
 *  the landing page instead of the portal. */
export function requiredRedirects(siteUrl) {
  const urls = ['http://localhost:3000/auth/confirm'];
  const base = (siteUrl ?? '').trim().replace(/\/+$/, '');
  if (base && !base.startsWith('http://localhost')) urls.unshift(`${base}/auth/confirm`);
  return urls;
}

/** Adds the missing entries without dropping any the project already trusts. */
export function mergeAllowList(existing, required) {
  const current = (Array.isArray(existing) ? existing : String(existing ?? '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
  const merged = [...current];
  for (const url of required) if (!merged.includes(url)) merged.push(url);
  return merged;
}

function template(name) {
  return readFileSync(join(ROOT, 'supabase', 'email-templates', `${name}.html`), 'utf8');
}

async function call(ref, token, method, body) {
  const response = await fetch(`${API}/${ref}/config/auth`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`${method} config/auth failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function report(current, next) {
  const smtp = current.smtp_host ? `configured (${current.smtp_host})` : 'NOT configured';
  console.log(`site_url:        ${current.site_url || '(empty)'}`);
  console.log(`smtp:            ${smtp} — untouched by this script`);
  console.log(`otp expiry:      ${current.mailer_otp_exp}s → ${next.mailer_otp_exp}s`);
  console.log(`allow list:      ${next.uri_allow_list}`);
  for (const name of ['magic_link', 'invite']) {
    const before = current[`mailer_templates_${name}_content`] ?? '';
    const stock = before.includes('ConfirmationURL') || before.length === 0;
    console.log(`${name} template: ${stock ? 'stock/default' : 'custom'} → project template`);
  }
  if (!current.site_url) {
    console.warn('\nWARNING: Site URL is empty. {{ .SiteURL }} in the templates resolves to');
    console.warn('nothing, so every link in the mail breaks. Set it before sending anything.');
  }
  if (!current.smtp_host) {
    console.warn('\nWARNING: no custom SMTP. Supabase will only deliver to project team members.');
  }
}

async function main(argv) {
  const apply = argv.includes('--apply');
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is required (Supabase dashboard → Account → Access Tokens)',
    );
  }
  const ref =
    argv.find((arg) => !arg.startsWith('--')) ??
    readFileSync(join(ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();

  const current = await call(ref, token, 'GET');
  const next = {
    uri_allow_list: mergeAllowList(
      current.uri_allow_list,
      requiredRedirects(current.site_url),
    ).join(','),
    mailer_otp_exp: OTP_EXPIRY_SECONDS,
    mailer_subjects_magic_link: SUBJECTS.magic_link,
    mailer_templates_magic_link_content: template('magic-link'),
    mailer_subjects_invite: SUBJECTS.invite,
    mailer_templates_invite_content: template('invite'),
  };

  console.log(`project ${ref}\n`);
  report(current, next);
  if (!apply) {
    console.log('\nDry run — nothing changed. Re-run with --apply to write these settings.');
    return;
  }
  await call(ref, token, 'PATCH', next);
  console.log('\nApplied.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
