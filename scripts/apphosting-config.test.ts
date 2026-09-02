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

const LOCAL_ONLY_DATABASE_CLIENTS = ['@google-cloud/firestore'];

function findLocalDatabaseClientImports(): string[] {
  return readdirSync('src', { encoding: 'utf8', recursive: true })
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path))
    .filter((path) => {
      const source = readFileSync(join('src', path), 'utf8');
      return LOCAL_ONLY_DATABASE_CLIENTS.some((packageName) => source.includes(packageName));
    });
}

type DeployedVariable = {
  variable: string;
  value: string | null;
  secret: string | null;
  availability: string[];
};

/** A targeted read of the `env:` list rather than a YAML parse: no YAML library
 *  is a declared dependency, and only these four fields are under test. */
function deployedEnvironment(): DeployedVariable[] {
  const entries: DeployedVariable[] = [];
  for (const line of readFileSync('apphosting.yaml', 'utf8').split('\n')) {
    const declared = /^ {2}- variable: (\S+)/.exec(line);
    if (declared) {
      entries.push({ variable: declared[1], value: null, secret: null, availability: [] });
      continue;
    }
    const current = entries.at(-1);
    if (!current) continue;
    const value = /^ {4}value: (.*)$/.exec(line);
    if (value) current.value = value[1].trim().replace(/^'(.*)'$/, '$1');
    const secret = /^ {4}secret: (\S+)/.exec(line);
    if (secret) current.secret = secret[1];
    const availability = /^ {6}- (BUILD|RUNTIME)\b/.exec(line);
    if (availability) current.availability.push(availability[1]);
  }
  return entries;
}

function deployedVariable(name: string): DeployedVariable | undefined {
  return deployedEnvironment().find((entry) => entry.variable === name);
}

describe('deployed environment', () => {
  // App Hosting's preparer rejects an entry that carries neither, `value: ''`
  // included, and the rollout fails before the build ever starts.
  it('gives every variable a non-empty value or a secret', () => {
    const undeclared = deployedEnvironment()
      .filter((entry) => !entry.value && !entry.secret)
      .map((entry) => entry.variable);

    expect(undeclared).toEqual([]);
  });
});

describe('deployed abuse challenge', () => {
  it('gates the first chat message with the self-hosted proof of work', () => {
    expect(deployedVariable('CHALLENGE_ENABLED')?.value).toBe('true');
    expect(deployedVariable('CHALLENGE_PROVIDER')?.value).toBe('pow');
  });

  it('reaches the browser bundle, without which every opening message is rejected', () => {
    const mirrored = deployedVariable('NEXT_PUBLIC_CHALLENGE_PROVIDER');

    expect(mirrored?.value).toBe(deployedVariable('CHALLENGE_PROVIDER')?.value);
    expect(mirrored?.availability).toContain('BUILD');
  });
});

describe('deployed analytics', () => {
  it('inlines the public measurement id into the browser bundle', () => {
    const measurementId = deployedVariable('NEXT_PUBLIC_GA_MEASUREMENT_ID');

    expect(measurementId?.value).toMatch(/^G-[A-Z0-9]{4,20}$/);
    expect(measurementId?.availability).toContain('BUILD');
  });

  // The Data API addresses the numeric property, not the `G-` id; swapping the
  // two leaves the banner working and the dashboard cards permanently at "—".
  it('addresses the Data API by the numeric property id', () => {
    expect(deployedVariable('GA_PROPERTY_ID')?.value).toMatch(/^\d{1,20}$/);
  });

  it('keeps the reporting credentials in Secret Manager', () => {
    expect(deployedVariable('GA_SERVICE_ACCOUNT_JSON')?.secret).toBe('gaServiceAccountJson');
  });
});

describe('App Hosting source rollout config', () => {
  it('allows deployment from the protected local source', () => {
    expect(firebaseConfig.apphosting.alwaysDeployFromSource).toBe(true);
  });

  it('excludes local tooling sources from the deployment archive', () => {
    const ignoredSources = firebaseConfig.apphosting.ignore;

    expect(ignoredSources).toEqual(expect.arrayContaining(['scripts', 'e2e', 'docs']));
  });

  it('keeps local-only database clients out of production dependencies', () => {
    const localClientsInProduction = LOCAL_ONLY_DATABASE_CLIENTS.filter(
      (packageName) => packageName in packageConfig.dependencies,
    );

    expect(localClientsInProduction).toEqual([]);
  });

  it('retains local-only database clients for emulator and import tooling', () => {
    const developmentPackages = Object.keys(packageConfig.devDependencies);

    expect(developmentPackages).toEqual(expect.arrayContaining(LOCAL_ONLY_DATABASE_CLIENTS));
  });

  it('prevents local-only database clients from entering runtime source', () => {
    expect(findLocalDatabaseClientImports()).toEqual([]);
  });
});
