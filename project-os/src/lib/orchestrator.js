import { runActiveAgent, activeAgent } from './agents.js';
import { routeModel }                  from './modelRouter.js';
import { resolveVariant }              from './abAssigner.js';
import { query }                       from '../db/pool.js';

const RETRYABLE = new Set([429, 502, 503]);

async function logRoutingDecision({ agentTraceId, agent, stage, inputs, chosenModel, ruleFired, fallbackChain }) {
  query(
    `INSERT INTO routing_decisions
       (agent_trace_id, agent, stage, inputs, chosen_model, rule_fired, fallback_chain)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      agentTraceId ?? null,
      agent, stage,
      JSON.stringify(inputs),
      chosenModel, ruleFired,
      fallbackChain,
    ],
  ).catch(err => console.error('[orchestrator] routing log failed', err));
}

export async function runWithOrchestration({ project, state, history, userMessage, meta = null }) {
  const agent = activeAgent(project.stage);

  // Resolve A/B variant — overrides model if an active experiment exists
  const variant = await resolveVariant(meta?.projectId ?? null, agent).catch(() => null);
  const routing = routeModel({ agent, stage: project.stage, history, state });

  // If variant is active, use its model; otherwise use router-chosen model
  const primaryModel    = variant?.model ?? routing.model;
  const primaryChain    = variant ? [variant.model, ...routing.fallbackChain.slice(1)] : routing.fallbackChain;
  const variantId       = variant?.variantId ?? null;

  let lastErr = null;

  for (const model of primaryChain) {
    const routedMeta = meta
      ? { ...meta, agent, model, variantId }
      : { agent, model, variantId };

    try {
      const result = await runActiveAgent({
        project,
        state,
        history,
        userMessage,
        meta: routedMeta,
      });

      logRoutingDecision({
        agentTraceId:  null,
        agent,
        stage:         project.stage,
        inputs:        routing.inputs,
        chosenModel:   model,
        ruleFired:     model === primaryModel ? routing.ruleFired : `fallback-${model}`,
        fallbackChain: primaryChain,
      });

      return result;
    } catch (err) {
      lastErr = err;
      if (!RETRYABLE.has(err.status)) throw err;
      console.warn(`[orchestrator] ${model} returned ${err.status}, trying next in chain`);
    }
  }

  throw lastErr;
}
