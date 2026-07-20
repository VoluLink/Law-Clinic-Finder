// Imports clinics from a JSON export of the directory spreadsheet.
// Usage: node scripts/import-clinics.mjs <clinics.json>
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the env.
// Idempotent via upsert on the unique clinic name. NOTE: re-importing
// re-publishes rows an admin may have unpublished.
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const clinicImportSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(500).nullable(),
  region: z.string().max(200).nullable(),
  legal_areas: z.string().max(2000),
  target_clients: z.string().max(2000).nullable(),
  languages: z.string().max(1000).nullable(),
  requirements: z.string().max(4000).nullable(),
  is_published: z.boolean(),
});

const [, , jsonPath] = process.argv;
if (!jsonPath) throw new Error('Usage: node scripts/import-clinics.mjs <clinics.json>');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

const rows = z.array(clinicImportSchema).parse(JSON.parse(readFileSync(jsonPath, 'utf-8')));
const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const demo = await client
  .from('clinics')
  .delete()
  .like('contact_email', '%@example.org')
  .select('name');
if (demo.error) throw new Error(`demo cleanup failed: ${demo.error.message}`);

const { error } = await client.from('clinics').upsert(rows, { onConflict: 'name' });
if (error) throw new Error(`import failed: ${error.message}`);

const { count } = await client.from('clinics').select('*', { count: 'exact', head: true });
process.stdout.write(
  `${JSON.stringify({ imported: rows.length, demoRemoved: demo.data?.length ?? 0, totalInDb: count })}\n`,
);
