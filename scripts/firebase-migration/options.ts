import { z } from 'zod';

const TARGET_PROJECT = 'law-clinic-finder';
const TARGET_DATABASE = 'primary-eu';
const FLAG_ARGUMENTS = new Set(['--apply', '--verify', '--reconcile']);
const VALUE_ARGUMENTS = new Set(['--source-ref', '--run-id', '--confirm-target']);

type Environment = Readonly<Record<string, string | undefined>>;

const argumentSchema = z.object({
  sourceRef: z.string().regex(/^[a-z0-9]{10,40}$/),
  runId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
  apply: z.boolean(),
  verify: z.boolean(),
  reconcile: z.boolean(),
  confirmTarget: z.string().optional(),
});

const environmentSchema = z.object({
  sourceUrl: z.url(),
  sourceSecret: z.string().min(1),
  targetProject: z.literal(TARGET_PROJECT),
  databaseId: z.literal(TARGET_DATABASE),
  storageBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]+\.(?:appspot\.com|firebasestorage\.app)$/),
});

export type MigrationOptions = ReturnType<typeof parseMigrationOptions>;

export function parseMigrationOptions(args: string[], env: Environment) {
  const parsedArgs = argumentSchema.parse(readArguments(args));
  const mode = parsedArgs.apply ? 'apply' : parsedArgs.verify ? 'verify' : 'dry-run';
  const parsedEnv = readEnvironment(env, mode === 'dry-run');
  assertSourceProject(parsedEnv.sourceUrl, parsedArgs.sourceRef);
  assertCompatibleMode(parsedArgs);
  return { ...parsedEnv, ...parsedArgs, mode } as const;
}

function assertCompatibleMode(parsedArgs: z.infer<typeof argumentSchema>): void {
  if (parsedArgs.apply && parsedArgs.verify) throw new Error('Choose either --apply or --verify');
  if (parsedArgs.reconcile && !parsedArgs.apply) {
    throw new Error('--reconcile requires --apply');
  }
  if (parsedArgs.apply && parsedArgs.confirmTarget !== TARGET_PROJECT) {
    throw new Error(`--confirm-target ${TARGET_PROJECT} is required with --apply`);
  }
}

function readArguments(args: string[]) {
  assertKnownArguments(args);
  const values = readArgumentValues(args);
  return {
    sourceRef: values.get('--source-ref'),
    runId: values.get('--run-id'),
    confirmTarget: values.get('--confirm-target'),
    apply: args.includes('--apply'),
    verify: args.includes('--verify'),
    reconcile: args.includes('--reconcile'),
  };
}

function readArgumentValues(args: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (FLAG_ARGUMENTS.has(argument)) continue;
    if (!argument.startsWith('--') || !args[index + 1])
      throw new Error(`Invalid argument: ${argument}`);
    values.set(argument, args[index + 1]);
    index += 1;
  }
  return values;
}

function assertKnownArguments(args: string[]): void {
  const unknown = args.filter(
    (argument) =>
      argument.startsWith('--') && !FLAG_ARGUMENTS.has(argument) && !VALUE_ARGUMENTS.has(argument),
  );
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
}

function readEnvironment(env: Environment, allowDefaults: boolean) {
  return environmentSchema.parse({
    sourceUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    sourceSecret: env.SUPABASE_SECRET_KEY,
    targetProject:
      env.FIREBASE_PROJECT_ID ??
      env.GOOGLE_CLOUD_PROJECT ??
      (allowDefaults ? TARGET_PROJECT : undefined),
    databaseId: env.FIREBASE_DATABASE_ID ?? (allowDefaults ? TARGET_DATABASE : undefined),
    storageBucket:
      env.FIREBASE_STORAGE_BUCKET ??
      (allowDefaults ? `${TARGET_PROJECT}.firebasestorage.app` : undefined),
  });
}

function assertSourceProject(sourceUrl: string, sourceRef: string): void {
  const url = new URL(sourceUrl);
  const expectedHost = `${sourceRef}.supabase.co`;
  if (
    url.protocol !== 'https:' ||
    url.host !== expectedHost ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Source URL must be exactly https://${expectedHost}`);
  }
}
