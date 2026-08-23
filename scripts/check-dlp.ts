/**
 * Pre-flight check for the Cloud DLP de-identification boundary.
 *
 * The chat fails closed: with `REDACTION_PROVIDER=dlp`, anything DLP rejects
 * takes the chat down rather than forwarding an un-inspected message. A single
 * misspelled infoType is therefore a total outage, so this proves the exact
 * request the runtime will send actually works before the switch is flipped.
 *
 *   npm run dlp:check
 *
 * Read-only: it inspects one synthetic sentence containing no real personal
 * data and writes nothing. Requires the DLP API enabled and credentials with
 * `dlp.user` on the project.
 */
import { pathToFileURL } from 'node:url';

import { deidentifyMessages, DLP_INFO_TYPES } from '../src/lib/security/deidentify';

const PROBE = 'Ich heiße Max Mustermann, wohne in 50667 Köln und schreibe an max@example.org.';
const EXPECTED_INTACT = ['50667', 'Köln'];

export type ProbeReport = {
  ok: boolean;
  reason?: string;
  output?: string;
  placesKept: boolean;
  identifiersRemoved: boolean;
};

export function assessProbe(result: Awaited<ReturnType<typeof deidentifyMessages>>): ProbeReport {
  if (!result.ok)
    return { ok: false, reason: result.reason, placesKept: false, identifiersRemoved: false };
  const output = result.messages[0].content;
  return {
    ok: true,
    output,
    placesKept: EXPECTED_INTACT.every((token) => output.includes(token)),
    identifiersRemoved: !output.includes('max@example.org') && !output.includes('Mustermann'),
  };
}

async function main(): Promise<void> {
  const location = process.env.DLP_LOCATION ?? 'europe-west4';
  console.log(`project  : ${process.env.FIREBASE_PROJECT_ID ?? '(unset)'}`);
  console.log(`location : ${location}`);
  console.log(`infoTypes: ${DLP_INFO_TYPES.length} requested\n`);

  const report = assessProbe(await deidentifyMessages([{ role: 'user', content: PROBE }]));
  if (!report.ok) {
    console.error(`FAILED — de-identification refused the probe: ${report.reason}`);
    console.error('The chat would be unavailable with this configuration.');
    process.exitCode = 1;
    return;
  }
  console.log(`in  : ${PROBE}`);
  console.log(`out : ${report.output}\n`);
  console.log(`identifiers removed : ${report.identifiersRemoved ? 'yes' : 'NO'}`);
  console.log(`postal code and city kept : ${report.placesKept ? 'yes' : 'NO'}`);
  if (!report.placesKept || !report.identifiersRemoved) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) void main();
