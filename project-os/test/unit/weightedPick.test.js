import { describe, test, expect } from 'vitest';
import { weightedPick } from '../../src/lib/abAssigner.js';

const v = (id, w) => ({ id, traffic_weight: w });

describe('weightedPick', () => {
  test('returns first variant when roll is 0', () => {
    const variants = [v('a', 50), v('b', 50)];
    expect(weightedPick(variants, 0).id).toBe('a');
  });

  test('returns first variant when roll is just under first weight', () => {
    const variants = [v('a', 50), v('b', 50)];
    expect(weightedPick(variants, 49.99).id).toBe('a');
  });

  test('returns second variant when roll equals first weight', () => {
    const variants = [v('a', 50), v('b', 50)];
    expect(weightedPick(variants, 50).id).toBe('b');
  });

  test('returns last variant when roll is at total weight', () => {
    const variants = [v('a', 30), v('b', 30), v('c', 40)];
    expect(weightedPick(variants, 100).id).toBe('c');
  });

  test('single variant always returned regardless of roll', () => {
    const variants = [v('only', 100)];
    expect(weightedPick(variants, 0).id).toBe('only');
    expect(weightedPick(variants, 50).id).toBe('only');
    expect(weightedPick(variants, 99.99).id).toBe('only');
  });

  test('handles unequal weights correctly', () => {
    const variants = [v('a', 10), v('b', 90)];
    expect(weightedPick(variants, 5).id).toBe('a');
    expect(weightedPick(variants, 10).id).toBe('b');
    expect(weightedPick(variants, 95).id).toBe('b');
  });

  test('returns last element as fallback for out-of-range roll', () => {
    const variants = [v('a', 50), v('b', 50)];
    expect(weightedPick(variants, 200).id).toBe('b');
  });
});
