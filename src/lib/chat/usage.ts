export type TokenUsage = { inputTokens: number; outputTokens: number };

/**
 * USD per 1,000,000 tokens, matched by model-id prefix. This map is the single
 * source for the dashboard cost figure — verify it against current Anthropic
 * pricing when models or rates change. Unmapped models contribute 0 (unknown),
 * so a wrong figure is never invented for a model we have not priced.
 */
const PRICING: Array<{ prefix: string; input: number; output: number }> = [
  { prefix: 'claude-haiku', input: 1, output: 5 },
  { prefix: 'claude-sonnet', input: 3, output: 15 },
  { prefix: 'claude-opus', input: 15, output: 75 },
];

const TOKENS_PER_UNIT = 1_000_000;

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICING.find((entry) => model.startsWith(entry.prefix));
  if (!price) return 0;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / TOKENS_PER_UNIT;
}

export function formatUsd(amount: number): string {
  return `$ ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
