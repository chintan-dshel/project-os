import { describe, test, expect } from 'vitest';
import { estimateTokens, countTasks, routeModel } from '../../src/lib/modelRouter.js';
import { MODELS } from '../../src/lib/models.js';

describe('estimateTokens', () => {
  test('returns 0 for empty / null history', () => {
    expect(estimateTokens([])).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  test('estimates token count proportional to char length', () => {
    const history = [{ role: 'user', content: 'a'.repeat(750) }];
    expect(estimateTokens(history)).toBe(1000);
  });

  test('sums across multiple messages', () => {
    const history = [
      { role: 'user',      content: 'a'.repeat(750) },
      { role: 'assistant', content: 'a'.repeat(750) },
    ];
    expect(estimateTokens(history)).toBe(2000);
  });

  test('handles messages with no content', () => {
    expect(estimateTokens([{ role: 'user' }])).toBe(0);
  });
});

describe('countTasks', () => {
  test('returns 0 for null / no phases', () => {
    expect(countTasks(null)).toBe(0);
    expect(countTasks({})).toBe(0);
    expect(countTasks({ phases: [] })).toBe(0);
  });

  test('counts tasks across phases and milestones', () => {
    const state = {
      phases: [
        { milestones: [
          { tasks: [1, 2, 3] },
          { tasks: [4, 5] },
        ]},
        { milestones: [
          { tasks: [6] },
        ]},
      ],
    };
    expect(countTasks(state)).toBe(6);
  });

  test('handles milestones with no tasks array', () => {
    expect(countTasks({ phases: [{ milestones: [{}] }] })).toBe(0);
  });
});

describe('routeModel', () => {
  test('retro agent always routes to Haiku', () => {
    const { model, ruleFired } = routeModel({ agent: 'retro', stage: 'ship_retro', history: [], state: null });
    expect(model).toBe(MODELS.HAIKU);
    expect(ruleFired).toBe('retro-default-haiku');
  });

  test('large context routes to Opus', () => {
    const bigHistory = [{ role: 'user', content: 'a'.repeat(8000 * 0.75 + 10) }];
    const { model, ruleFired } = routeModel({ agent: 'intake', stage: 'intake', history: bigHistory, state: null });
    expect(model).toBe(MODELS.OPUS);
    expect(ruleFired).toBe('large-context-opus');
  });

  test('execution with many tasks routes to Sonnet', () => {
    const state = {
      phases: [{ milestones: [{ tasks: Array(15).fill(null) }] }],
    };
    const { model, ruleFired } = routeModel({ agent: 'execution', stage: 'execution', history: [], state });
    expect(model).toBe(MODELS.SONNET);
    expect(ruleFired).toBe('execution-many-tasks-sonnet');
  });

  test('default intake message routes to Sonnet', () => {
    const { model, ruleFired } = routeModel({ agent: 'intake', stage: 'intake', history: [], state: null });
    expect(model).toBe(MODELS.SONNET);
    expect(ruleFired).toBe('default-sonnet');
  });

  test('returns fallbackChain for the chosen model', () => {
    const { fallbackChain } = routeModel({ agent: 'intake', stage: 'intake', history: [], state: null });
    expect(fallbackChain).toContain(MODELS.SONNET);
    expect(fallbackChain.length).toBeGreaterThanOrEqual(1);
  });

  test('retro rule takes precedence over large-context rule', () => {
    const bigHistory = [{ role: 'user', content: 'a'.repeat(8000 * 0.75 + 10) }];
    const { model } = routeModel({ agent: 'retro', stage: 'ship_retro', history: bigHistory, state: null });
    expect(model).toBe(MODELS.HAIKU);
  });
});
