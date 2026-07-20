// Dev-only: removes the seeded test accounts from the Supabase project.
//
// Usage: npm run dev:login:teardown
//
// Seeding moved into the app (src/lib/dev/dev-login.ts) so the two dev logins
// are one click on /login instead of a pasted magic link — this script is now
// only the cleanup half. The accounts it deletes are REAL rows in the live
// project, so run it before publishing (G-7).
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const DEV_EMAIL_DOMAIN = '@example.com';

// Must stay in step with DEV_ACCOUNTS in src/lib/dev/dev-login.ts. Kept as a
// literal because a .mjs script cannot import the TypeScript module.
const DEV_EMAILS = [`admin${DEV_EMAIL_DOMAIN}`, `startright${DEV_EMAIL_DOMAIN}`];

/** example.com is RFC 2606 reserved: undeliverable, so no real inbox can ever
 *  be deleted by a mistake here. */
export function assertDevEmail(email) {
  if (!email.toLowerCase().endsWith(DEV_EMAIL_DOMAIN)) {
    throw new Error(
      `Refusing "${email}": dev logins must use a reserved ${DEV_EMAIL_DOMAIN} address`,
    );
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} — run with: node --env-file=.env.local`);
  return value;
}

function createAdminClient() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-login must never run with NODE_ENV=production');
  }
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listDevUsers(client) {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const wanted = new Set(DEV_EMAILS.map((email) => email.toLowerCase()));
  return data.users.filter((user) => wanted.has(user.email?.toLowerCase() ?? ''));
}

async function teardown(client) {
  const users = await listDevUsers(client);
  for (const user of users) {
    assertDevEmail(user.email ?? '');
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`deleteUser failed for ${user.email}: ${error.message}`);
    process.stdout.write(`deleted ${user.email}\n`);
  }
  process.stdout.write(`${users.length} dev account(s) removed; profiles cascade automatically.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Deletion stays behind an explicit flag: running this file by accident
  // should print usage, not remove accounts.
  if (!process.argv.includes('--teardown')) {
    process.stdout.write('Usage: npm run dev:login:teardown\n');
    process.exit(1);
  }
  await teardown(createAdminClient());
}
