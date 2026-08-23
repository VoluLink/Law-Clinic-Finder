import { z } from 'zod';

import { DEFAULT_POW_DIFFICULTY } from './challenge';
import { solveProofOfWork } from './solve-challenge';

/**
 * Public mirror of the server's challenge configuration. The server stays the
 * authority — it rejects a missing or wrong solution regardless of what the
 * browser believes — so these values only decide whether the browser bothers to
 * do the work. They must be kept in step with `CHALLENGE_*`.
 */
const providerSchema = z.enum(['', 'pow', 'turnstile']).catch('');
const difficultySchema = z.coerce.number().int().min(1).max(24).catch(DEFAULT_POW_DIFFICULTY);

const PROVIDER = providerSchema.parse(process.env.NEXT_PUBLIC_CHALLENGE_PROVIDER ?? '');
const DIFFICULTY = difficultySchema.parse(process.env.NEXT_PUBLIC_CHALLENGE_POW_DIFFICULTY);

/**
 * Returns the solution for the opening turn, or undefined when no challenge is
 * configured. Never throws: a failed challenge must not stop someone asking a
 * legal question — the server decides whether to accept the request.
 */
export async function solveChatChallenge(sessionId: string): Promise<string | undefined> {
  if (PROVIDER !== 'pow') return undefined;
  try {
    return await solveProofOfWork(sessionId, DIFFICULTY);
  } catch {
    return undefined;
  }
}
