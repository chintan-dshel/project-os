import { MODELS, FALLBACK_CHAINS } from './models.js';

// inputs shape: { agent, stage, contextTokens, taskCount }
const RULES = [
  {
    name: 'retro-default-haiku',
    test: ({ agent }) => agent === 'retro',
    model: MODELS.HAIKU,
  },
  {
    name: 'large-context-opus',
    test: ({ contextTokens }) => contextTokens > 8000,
    model: MODELS.OPUS,
  },
  {
    name: 'execution-many-tasks-sonnet',
    test: ({ agent, taskCount }) => agent === 'execution' && taskCount >= 15,
    model: MODELS.SONNET,
  },
  {
    name: 'default-sonnet',
    test: () => true,
    model: MODELS.SONNET,
  },
];

// Rough token estimate: ~1.3 tokens per char, averaged over typical messages
export function estimateTokens(history) {
  const chars = (history ?? []).reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
  return Math.round(chars / 0.75);
}

export function countTasks(state) {
  return (state?.phases ?? [])
    .flatMap(p => p.milestones ?? [])
    .flatMap(m => m.tasks ?? [])
    .length;
}

export function routeModel({ agent, stage, history, state }) {
  const inputs = {
    agent,
    stage,
    contextTokens: estimateTokens(history),
    taskCount:     countTasks(state),
  };

  for (const rule of RULES) {
    if (rule.test(inputs)) {
      return {
        model:         rule.model,
        ruleFired:     rule.name,
        fallbackChain: FALLBACK_CHAINS[rule.model] ?? [rule.model],
        inputs,
      };
    }
  }

  return { model: MODELS.SONNET, ruleFired: 'default-sonnet', fallbackChain: FALLBACK_CHAINS[MODELS.SONNET], inputs };
}
