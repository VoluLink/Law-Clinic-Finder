import { leadingZeroBits, powPayload } from './challenge';

/**
 * Browser side of the proof-of-work challenge. Yields to the event loop every
 * `YIELD_INTERVAL` attempts so a slow device keeps painting and stays scrollable
 * while it works — a frozen tab would be a worse experience than the abuse it
 * prevents.
 */
const YIELD_INTERVAL = 512;
const MAX_ATTEMPTS = 5_000_000;

export type ChallengeConfig = { provider: string; difficulty: number };

async function digestBits(sessionId: string, nonce: string): Promise<number> {
  const bytes = new TextEncoder().encode(powPayload(sessionId, nonce));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return leadingZeroBits(new Uint8Array(digest));
}

export async function solveProofOfWork(sessionId: string, difficulty: number): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const nonce = String(attempt);
    if ((await digestBits(sessionId, nonce)) >= difficulty) return nonce;
    if (attempt % YIELD_INTERVAL === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('proof of work exhausted');
}
