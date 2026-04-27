/**
 * Human-facing MUSD (and similar) amounts: snap to 2 decimal places to avoid float noise
 * (e.g. 0.8300000000000001). On-chain, use `parseUnits(roundMoney2(amount).toFixed(2), 18)` so wei
 * matches this exact human value while still using full token decimals.
 */
export function roundMoney2(value: number): number {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  return Number.parseFloat(Number(value).toFixed(2));
}

/**
 * Combined discount rates (sum of fractional rates like 0.05 + 0.08). Extra digits avoid
 * float artifacts without collapsing small tier stacks into 2dp.
 */
export function roundDiscountRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number.parseFloat(value.toFixed(6));
}
