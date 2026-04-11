/**
 * lib/agents.js — v0.5
 *
 * All four agents wired. Retro is now fully live.
 *
 * KEY ADDITION: agent-initiated first messages.
 * When a project enters a new stage, the FIRST message in chat
 * comes FROM the agent, not waiting for the user.
 * This eliminates every "blank chat" dead end.
 */

import { runIntakeAgent }    from './intake.agent.js';
import { runPlanningAgent }  from './planning.agent.js';
import { runExecutionAgent } from './execution.agent.js';
import { runRetroAgent }     from './retro.agent.js';

export const STAGE_AGENT = {
  intake:            'intake',
  planning:          'planning',
  awaiting_approval: 'planning',
  execution:         'execution',
  milestone_retro:   'retro',
  ship_retro:        'retro',
  complete:          'retro',
};

export function activeAgent(stage) {
  return STAGE_AGENT[stage] ?? 'intake';
}

export async function runActiveAgent({ project, state, history, userMessage }) {
  const agent = activeAgent(project.stage);

  switch (agent) {
    case 'intake':
      return runIntakeAgent({ project, history, userMessage });

    case 'planning':
      return runPlanningAgent({ project, history, userMessage });

    case 'execution':
      return runExecutionAgent({ project, state, history, userMessage });

    case 'retro':
      return runRetroAgent({ project, state, history, userMessage });

    default:
      throw new Error(`Unknown agent for stage: ${project.stage}`);
  }
}
