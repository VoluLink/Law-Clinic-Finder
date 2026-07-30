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

/** Distinguishes a real $0 from the 0 `estimateCostUsd` returns for an unpriced model. */
export function isPricedModel(model: string): boolean {
  return PRICING.some((entry) => model.startsWith(entry.prefix));
}

function formatAmount(amount: number, digits: number): string {
  const options = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  return `$ ${amount.toLocaleString('de-DE', options)}`;
}

export function formatUsd(amount: number): string {
  return formatAmount(amount, 2);
}

/** A single chat costs a fraction of a cent, which two decimals would flatten to $ 0,00. */
export function formatUsdPrecise(amount: number): string {
  return formatAmount(amount, 4);
}
