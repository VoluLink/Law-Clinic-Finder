import { describe, expect, it } from 'vitest';

import { estimateCostUsd, formatUsd } from './usage';

describe(estimateCostUsd, () => {
  it('prices Haiku by input and output tokens', () => {
    // 1M input @ $1 + 1M output @ $5 = $6.
    expect(
      estimateCostUsd('claude-haiku-4-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    ).toBe(6);
  });

  it('returns 0 for a model without a known price', () => {
    expect(estimateCostUsd('some-other-model', { inputTokens: 1_000_000, outputTokens: 0 })).toBe(
      0,
    );
  });
});

describe(formatUsd, () => {
  it('formats to two decimals with a dollar sign', () => {
    expect(formatUsd(42.5)).toBe('$ 42,50');
  });
});
