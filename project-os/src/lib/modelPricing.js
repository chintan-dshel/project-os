// USD per 1M tokens. UPDATE THIS FILE WHEN PRICES CHANGE.
// Source: https://www.anthropic.com/pricing (verified 2026-04-24)
export const MODEL_PRICING = {
  'claude-opus-4-7-20251101':         { input: 15.00, output: 75.00 },
  'claude-opus-4-6-20250514':         { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6-20250514':       { input:  3.00, output: 15.00 },
  'claude-sonnet-4-5-20251001':       { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':        { input:  0.80, output:  4.00 },
  // Short aliases used internally
  'claude-opus-4-7':                  { input: 15.00, output: 75.00 },
  'claude-opus-4-6':                  { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':                { input:  3.00, output: 15.00 },
  'claude-haiku-4-5':                 { input:  0.80, output:  4.00 },
  // Legacy model used in current codebase
  'claude-sonnet-4-20250514':         { input:  3.00, output: 15.00 },
};

export function getPricing(model) {
  const entry = MODEL_PRICING[model];
  if (!entry) {
    // Unknown model — cost_usd will record as 0, visible signal to update this table.
    console.warn(`[modelPricing] No pricing entry for model: ${model}`);
    return { input: 0, output: 0 };
  }
  return entry;
}

export function computeCostUsd(model, promptTokens, completionTokens) {
  const { input, output } = getPricing(model);
  return (promptTokens / 1_000_000) * input + (completionTokens / 1_000_000) * output;
}
