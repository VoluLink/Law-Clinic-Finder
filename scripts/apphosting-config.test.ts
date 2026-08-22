import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const appHostingConfigSchema = z.object({
  apphosting: z.object({
    alwaysDeployFromSource: z.boolean(),
    backendId: z.literal('web'),
    ignore: z.array(z.string()),
  }),
});

const packageConfigSchema = z.object({
  dependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
});

const firebaseConfig = appHostingConfigSchema.parse(
  JSON.parse(readFileSync('firebase.json', 'utf8')) as unknown,
);
const packageConfig = packageConfigSchema.parse(
  JSON.parse(readFileSync('package.json', 'utf8')) as unknown,
);

const LOCAL_ONLY_DATABASE_CLIENTS = ['@google-cloud/firestore', '@supabase/supabase-js'];

function findLocalDatabaseClientImports(): string[] {
  return readdirSync('src', { encoding: 'utf8', recursive: true })
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path))
    .filter((path) => {
      const source = readFileSync(join('src', path), 'utf8');
      return LOCAL_ONLY_DATABASE_CLIENTS.some((packageName) => source.includes(packageName));
    });
}

describe('App Hosting source rollout config', () => {
  it('allows deployment from the protected local source', () => {
    expect(firebaseConfig.apphosting.alwaysDeployFromSource).toBe(true);
  });

  it('excludes local migration sources from the deployment archive', () => {
    const ignoredSources = firebaseConfig.apphosting.ignore;

    expect(ignoredSources).toEqual(expect.arrayContaining(['scripts', 'supabase']));
  });

  it('keeps local-only database clients out of production dependencies', () => {
    const localClientsInProduction = LOCAL_ONLY_DATABASE_CLIENTS.filter(
      (packageName) => packageName in packageConfig.dependencies,
    );

    expect(localClientsInProduction).toEqual([]);
  });

  it('retains local-only database clients for migration and emulator tooling', () => {
    const developmentPackages = Object.keys(packageConfig.devDependencies);

    expect(developmentPackages).toEqual(expect.arrayContaining(LOCAL_ONLY_DATABASE_CLIENTS));
  });

  it('prevents local-only database clients from entering runtime source', () => {
    expect(findLocalDatabaseClientImports()).toEqual([]);
  });
});
