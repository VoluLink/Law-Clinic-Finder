import { parseMigrationOptions } from './options';
import { prepareMigration } from './prepare';
import { readSourceDataset } from './source';
import { applyMigration, verifyMigration } from './target';

async function main(): Promise<void> {
  const options = parseMigrationOptions(process.argv.slice(2), process.env);
  writeStatus({ mode: options.mode, status: 'reading-source' });
  const source = await readSourceDataset(options);
  const bundle = await prepareMigration(source);
  writeStatus({ mode: options.mode, status: 'validated', phases: phaseSummary(bundle) });
  if (options.mode === 'apply') await applyMigration(options, bundle);
  if (options.mode === 'verify') await verifyMigration(options, bundle);
  writeStatus({ mode: options.mode, status: 'complete', phases: phaseSummary(bundle) });
}

function phaseSummary(bundle: Awaited<ReturnType<typeof prepareMigration>>) {
  return bundle.phases.map((phase) => ({
    name: phase.name,
    count: phase.documents.length,
    checksum: phase.checksum,
  }));
}

function writeStatus(status: object): void {
  process.stdout.write(`${JSON.stringify(status)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown migration error';
  process.stderr.write(`Firebase migration failed: ${message}\n`);
  process.exitCode = 1;
});
