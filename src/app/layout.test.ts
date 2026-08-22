import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Hanken_Grotesk: () => ({ variable: '--font-hanken-grotesk' }),
  Noto_Sans_Arabic: () => ({ variable: '--font-noto-arabic' }),
}));

import { metadata } from './layout';

describe('site metadata', () => {
  it('uses a concise, descriptive browser title', () => {
    expect(metadata.title).toBe('Kostenlose Rechtsberatung | Law Clinic Finder');
  });
});
