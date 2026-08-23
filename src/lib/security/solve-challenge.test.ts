import { describe, expect, it } from 'vitest';

import { verifyProofOfWork } from './challenge';
import { solveProofOfWork } from './solve-challenge';

const SESSION_ID = '3f1c2a5e-7b8d-4c1a-9e2f-0a1b2c3d4e5f';
const TEST_DIFFICULTY = 8;

describe(solveProofOfWork, () => {
  it('produces a nonce the server accepts', async () => {
    const nonce = await solveProofOfWork(SESSION_ID, TEST_DIFFICULTY);
    await expect(verifyProofOfWork(SESSION_ID, nonce, TEST_DIFFICULTY)).resolves.toBe(true);
  });

  it('produces a solution bound to its own conversation', async () => {
    const nonce = await solveProofOfWork(SESSION_ID, TEST_DIFFICULTY);
    const other = '11111111-2222-4333-8444-555555555555';
    await expect(verifyProofOfWork(other, nonce, TEST_DIFFICULTY)).resolves.toBe(false);
  });

  it('returns a numeric nonce', async () => {
    const nonce = await solveProofOfWork(SESSION_ID, TEST_DIFFICULTY);
    expect(nonce).toMatch(/^\d+$/);
  });
});
