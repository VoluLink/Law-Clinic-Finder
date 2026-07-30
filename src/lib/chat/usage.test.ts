import { describe, expect, it } from 'vitest';

import { estimateCostUsd, formatUsd, formatUsdPrecise, isPricedModel } from './usage';

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

describe(isPricedModel, () => {
  it('separates a priced model from one whose 0 only means unknown', () => {
    expect({
      haiku: isPricedModel('claude-haiku-4-5'),
      unknown: isPricedModel('some-other-model'),
    }).toEqual({ haiku: true, unknown: false });
  });
});

describe(formatUsd, () => {
  it('formats to two decimals with a dollar sign', () => {
    expect(formatUsd(42.5)).toBe('$ 42,50');
  });
});

describe(formatUsdPrecise, () => {
  it('keeps a single chat below a cent readable', () => {
    expect(formatUsdPrecise(0.0144)).toBe('$ 0,0144');
  });
});
