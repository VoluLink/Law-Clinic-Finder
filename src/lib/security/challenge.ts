import { z } from 'zod';

/**
 * Provider-neutral abuse challenge for the first message of a conversation.
 *
 * Two adapters, chosen by `CHALLENGE_PROVIDER`, mirroring how the SMTP boundary
 * keeps the mail provider out of the call sites:
 *
 * - `pow` (default) — a proof of work solved in the visitor's browser. No third
 *   party, no account, no cookie, no consent entry and nothing to provision, so
 *   it works today on a domain-less staging deployment. It is a cost multiplier,
 *   not a bot detector: it makes bulk abuse expensive without identifying anyone.
 * - `turnstile` — Cloudflare Turnstile, switched on once the site sits behind
 *   Cloudflare. Stronger, but it adds a processor that belongs in the
 *   Datenschutzerklärung, which is why it is not the default.
 *
 * The work is bound to the conversation's `sessionId`, so a solution cannot be
 * replayed into another conversation, and the existing daily quota already caps
 * how many conversations one visitor may open.
 */

export const CHALLENGE_PROVIDERS = ['pow', 'turnstile'] as const;
export type ChallengeProvider = (typeof CHALLENGE_PROVIDERS)[number];

/** Leading zero bits required. 16 costs a visitor well under a second and a bulk
 *  abuser ~65k hashes per conversation. Tunable without a deploy. */
export const DEFAULT_POW_DIFFICULTY = 16;
const MAX_POW_DIFFICULTY = 24;

const difficultySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_POW_DIFFICULTY)
  .catch(DEFAULT_POW_DIFFICULTY);

const providerSchema = z.enum(CHALLENGE_PROVIDERS).catch('pow');

export function challengeProvider(): ChallengeProvider {
  return providerSchema.parse(process.env.CHALLENGE_PROVIDER);
}

export function powDifficulty(): number {
  return difficultySchema.parse(process.env.CHALLENGE_POW_DIFFICULTY);
}

/** Off by default so local runs, tests and the emulator are never gated. */
export function challengeRequired(): boolean {
  return process.env.CHALLENGE_ENABLED === 'true';
}

export function leadingZeroBits(digest: Uint8Array): number {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

export function powPayload(sessionId: string, nonce: string): string {
  return `lcf-chat:${sessionId}:${nonce}`;
}

async function sha256(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function verifyProofOfWork(
  sessionId: string,
  nonce: string,
  difficulty: number,
): Promise<boolean> {
  if (!/^[0-9]{1,20}$/.test(nonce)) return false;
  const digest = await sha256(powPayload(sessionId, nonce));
  return leadingZeroBits(digest) >= difficulty;
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const turnstileResultSchema = z.object({ success: z.boolean() });

export async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
  if (!response.ok) return false;
  const parsed = turnstileResultSchema.safeParse(await response.json());
  return parsed.success && parsed.data.success;
}

export type ChallengeContext = { sessionId: string; token: string; clientIp: string | null };

export async function verifyChallenge(context: ChallengeContext): Promise<boolean> {
  if (challengeProvider() === 'turnstile') {
    return verifyTurnstile(context.token, context.clientIp);
  }
  return verifyProofOfWork(context.sessionId, context.token, powDifficulty());
}
