/**
 * Appends the suggestion/cards/explainer guidance to the assistant's Ablauf in
 * Firestore `settings/chat`. That document is the single source for the live
 * prompt (AR-11) and has no code fallback, so this ships as a data change rather
 * than an edit to `src/lib/chat/prompts.ts`.
 *
 *   npm run chat:guidance              # read-only preview, writes nothing
 *   npm run chat:guidance -- --apply --confirm-target law-clinic-finder
 *
 * Both `chat_skill` and its frozen revert baseline `chat_skill_default` are
 * updated, so an admin who reverts in /admin/assistant keeps the guidance.
 */
import { pathToFileURL } from 'node:url';

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { z } from 'zod';

import { hasSuggestionGuidance, withSuggestionGuidance } from './chat-guidance';

const TARGET_PROJECT = 'law-clinic-finder';
const TARGET_DATABASE = 'primary-eu';
const SKILL_KEY = 'chat_skill';
const SKILL_DEFAULT_KEY = 'chat_skill_default';

const settingsSchema = z.object({ values: z.record(z.string(), z.unknown()) });

export type GuidanceArguments = { apply: boolean; confirmedTarget: string | null };

export function parseGuidanceArguments(args: string[]): GuidanceArguments {
  const targetIndex = args.indexOf('--confirm-target');
  return {
    apply: args.includes('--apply'),
    confirmedTarget: targetIndex === -1 ? null : (args[targetIndex + 1] ?? null),
  };
}

export function guidancePlan(values: Record<string, unknown>) {
  const skill = z.string().min(1).parse(values[SKILL_KEY]);
  const baseline = z.string().catch('').parse(values[SKILL_DEFAULT_KEY]);
  return {
    alreadyApplied: hasSuggestionGuidance(skill) && hasSuggestionGuidance(baseline),
    skill: withSuggestionGuidance(skill),
    baseline: baseline ? withSuggestionGuidance(baseline) : baseline,
  };
}

function database(): Firestore {
  initializeApp({ credential: applicationDefault(), projectId: TARGET_PROJECT });
  return new Firestore({ projectId: TARGET_PROJECT, databaseId: TARGET_DATABASE });
}

async function main(args: string[]): Promise<void> {
  const options = parseGuidanceArguments(args);
  if (options.apply && options.confirmedTarget !== TARGET_PROJECT) {
    throw new Error(`--apply requires --confirm-target ${TARGET_PROJECT}`);
  }
  const store = database();
  const reference = store.collection('settings').doc('chat');
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error('settings/chat is missing — nothing to update');
  const plan = guidancePlan(settingsSchema.parse(snapshot.data()).values);

  if (plan.alreadyApplied) {
    process.stdout.write('Guidance already present in chat_skill and its baseline. No change.\n');
    return;
  }
  if (!options.apply) {
    process.stdout.write(`Preview only — nothing written.\n\n${plan.skill}\n`);
    return;
  }
  await store.runTransaction(async (transaction) => {
    const current = settingsSchema.parse((await transaction.get(reference)).data());
    transaction.set(reference, {
      values: {
        ...current.values,
        [SKILL_KEY]: plan.skill,
        ...(plan.baseline ? { [SKILL_DEFAULT_KEY]: plan.baseline } : {}),
      },
      updatedAt: Timestamp.now(),
    });
  });
  process.stdout.write('Guidance applied to chat_skill and chat_skill_default.\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'unknown'}\n`);
    process.exitCode = 1;
  });
}
