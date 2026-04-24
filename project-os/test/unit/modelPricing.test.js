import { describe, test, expect } from 'vitest';
import { getPricing, computeCostUsd, MODEL_PRICING } from '../../src/lib/modelPricing.js';

describe('getPricing', () => {
  test('returns correct pricing for known Sonnet model', () => {
    const p = getPricing('claude-sonnet-4-20250514');
    expect(p.input).toBe(3.00);
    expect(p.output).toBe(15.00);
  });

  test('returns correct pricing for known Opus model', () => {
    const p = getPricing('claude-opus-4-7-20251101');
    expect(p.input).toBe(15.00);
    expect(p.output).toBe(75.00);
  });

  test('returns correct pricing for Haiku model', () => {
    const p = getPricing('claude-haiku-4-5-20251001');
    expect(p.input).toBe(0.80);
    expect(p.output).toBe(4.00);
  });

  test('returns zero pricing for unknown model', () => {
    const p = getPricing('unknown-model-xyz');
    expect(p.input).toBe(0);
    expect(p.output).toBe(0);
  });

  test('all entries in MODEL_PRICING have numeric input and output', () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(typeof pricing.input, model).toBe('number');
      expect(typeof pricing.output, model).toBe('number');
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
    }
  });
});

describe('computeCostUsd', () => {
  test('computes correct cost for known quantities', () => {
    // Sonnet: $3/MTok input, $15/MTok output
    // 1000 input tokens = 0.001M → $0.003
    // 500 output tokens = 0.0005M → $0.0075
    const cost = computeCostUsd('claude-sonnet-4-20250514', 1000, 500);
    expect(cost).toBeCloseTo(0.003 + 0.0075, 6);
  });

  test('returns 0 for zero tokens', () => {
    expect(computeCostUsd('claude-sonnet-4-20250514', 0, 0)).toBe(0);
  });

  test('returns 0 for unknown model', () => {
    expect(computeCostUsd('unknown-model', 1000, 500)).toBe(0);
  });
});
