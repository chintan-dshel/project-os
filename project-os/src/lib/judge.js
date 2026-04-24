import { callClaude, extractJSON }    from './anthropic.js';
import { query }                       from '../db/pool.js';
import { getPricing, computeCostUsd }  from './modelPricing.js';

const GOLDEN_THRESHOLD = 4.5;

// ── Per-agent rubric prompt builders ─────────────────────────────────────────
// Each returns { system, userMessage } aligned with Option A parsing:
//   score_overall  = parsed.overall.score
//   breakdown      = all non-overall dimensions (score + reason each)
//   reasoning      = parsed.overall.summary

const RUBRIC_SCHEMA_SUFFIX = `\nRespond ONLY with the JSON object above. No prose, no fences.`;

function buildIntakePrompt({ input, output }) {
  const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user')?.content ?? '';
  return {
    system: `You are an expert evaluator of AI intake agents that turn project ideas into structured briefs.
Be rigorous. A score of 5 means genuinely excellent — not just acceptable.
Respond ONLY with a JSON object matching the schema below. No prose.`,
    userMessage: `## LAST USER MESSAGE
"${lastUserMsg.slice(0, 600)}"

## AGENT OUTPUT
${output.slice(0, 1200)}

## EVALUATION TASK
Rate each dimension 1–5.

{
  "inference_quality": {
    "score": null,
    "reason": "Did the agent make specific, reasonable inferences? Or produce generic placeholders?"
  },
  "assumption_transparency": {
    "score": null,
    "reason": "Are assumptions explicitly called out and logged as risks?"
  },
  "success_criteria_quality": {
    "score": null,
    "reason": "Are criteria specific and measurable, not generic vanity metrics?"
  },
  "scope_discipline": {
    "score": null,
    "reason": "Is v1 scope appropriately constrained? Are obvious creeps parked as out-of-scope?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on what would make this output notably better."
  }
}${RUBRIC_SCHEMA_SUFFIX}`,
  };
}

function buildPlanningPrompt({ input, output }) {
  const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user')?.content ?? '';
  return {
    system: `You are an expert evaluator of AI planning agents for solo founders.
Assess whether the generated plan is realistic, specific, and aligned with the brief.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON.`,
    userMessage: `## LAST USER MESSAGE
"${lastUserMsg.slice(0, 600)}"

## AGENT OUTPUT
${output.slice(0, 1200)}

## EVALUATION TASK
{
  "task_specificity": {
    "score": null,
    "reason": "Are tasks concrete, solo-founder-executable actions? Or vague activities?"
  },
  "hour_realism": {
    "score": null,
    "reason": "Are 1–3h estimates plausible for a solo founder? Any obvious over/underestimates?"
  },
  "plan_coherence": {
    "score": null,
    "reason": "Does the plan flow logically from the brief's success criteria?"
  },
  "scope_fit": {
    "score": null,
    "reason": "Does total estimated hours fit within the stated weekly capacity?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on the plan's biggest weakness."
  }
}${RUBRIC_SCHEMA_SUFFIX}`,
  };
}

function buildExecutionPrompt({ input, output }) {
  const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user')?.content ?? '';
  return {
    system: `You are an expert evaluator of AI execution coaching agents for solo founders.
Assess whether the agent challenged assumptions, surfaced risks, and maintained scope discipline.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON.`,
    userMessage: `## FOUNDER UPDATE
"${lastUserMsg.slice(0, 600)}"

## AGENT COACHING REPLY
${output.slice(0, 1200)}

## EVALUATION TASK
{
  "status_probing": {
    "score": null,
    "reason": "Did the agent probe 'done' claims by asking for concrete output?"
  },
  "risk_awareness": {
    "score": null,
    "reason": "Did the agent surface risks implied by the founder's update?"
  },
  "scope_discipline": {
    "score": null,
    "reason": "If scope creep was present, did the agent flag it and run an impact assessment?"
  },
  "momentum_calibration": {
    "score": null,
    "reason": "Is the momentum score reasonable given the situation described?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on the most important thing the agent missed."
  }
}${RUBRIC_SCHEMA_SUFFIX}`,
  };
}

function buildRetroPrompt({ input, output }) {
  const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user')?.content ?? '';
  return {
    system: `You are an expert evaluator of AI retrospective agents for solo founders.
Assess whether the retro contains genuine insight or generic platitudes.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON.`,
    userMessage: `## FOUNDER RETRO REQUEST
"${lastUserMsg.slice(0, 600)}"

## AGENT RETRO OUTPUT
${output.slice(0, 1200)}

## EVALUATION TASK
{
  "pattern_insight": {
    "score": null,
    "reason": "Are patterns_detected genuinely specific to this project? Or generic like 'underestimated complexity'?"
  },
  "friction_specificity": {
    "score": null,
    "reason": "Does what_created_friction reference actual details from the conversation?"
  },
  "forward_feed_quality": {
    "score": null,
    "reason": "Are forward_feed items actionable and specific to this founder's situation?"
  },
  "honest_accounting": {
    "score": null,
    "reason": "Does the retro acknowledge real gaps or gloss over them?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on whether this retro would actually make the next milestone better."
  }
}${RUBRIC_SCHEMA_SUFFIX}`,
  };
}

const RUBRIC_BUILDERS = {
  intake:    buildIntakePrompt,
  planning:  buildPlanningPrompt,
  execution: buildExecutionPrompt,
  retro:     buildRetroPrompt,
};

// ── Option A parse adapter ────────────────────────────────────────────────────
// Rubrics emit { dimension: { score, reason }, overall: { score, summary } }
// We extract: score_overall, breakdown (non-overall dims), reasoning (overall.summary)

function parseRubricResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const overall = parsed.overall;
  if (!overall || typeof overall.score !== 'number') return null;

  const breakdown = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (key === 'overall') continue;
    breakdown[key] = { score: val?.score ?? null, reason: val?.reason ?? null };
  }

  return {
    scoreOverall: overall.score,
    breakdown,
    reasoning:    overall.summary ?? null,
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function insertJudgeScore({ agentTraceId, agent, rubricVersion, scoreOverall, breakdown, judgeModel, judgeTokensIn, judgeTokensOut, judgeCostUsd, judgeLatencyMs, reasoning }) {
  await query(
    `INSERT INTO judge_scores
       (agent_trace_id, agent, rubric_version, score_overall, score_breakdown,
        judge_model, judge_tokens_in, judge_tokens_out,
        judge_cost_usd, judge_latency_ms, reasoning)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (agent_trace_id) DO NOTHING`,
    [
      agentTraceId, agent, rubricVersion,
      scoreOverall, JSON.stringify(breakdown),
      judgeModel, judgeTokensIn, judgeTokensOut,
      judgeCostUsd, judgeLatencyMs, reasoning,
    ],
  );
}

async function flagGoldenCandidate(agentTraceId, judgeScore) {
  await query(
    `INSERT INTO golden_candidates (agent_trace_id, judge_score, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (agent_trace_id) DO NOTHING`,
    [agentTraceId, judgeScore],
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scoreAgentResponse({ agentTraceId, agent, input, output, rubricVersion }) {
  const buildPrompt = RUBRIC_BUILDERS[agent];
  if (!buildPrompt) {
    console.warn(`[judge] no rubric for agent "${agent}", skipping`);
    return;
  }

  const { system, userMessage } = buildPrompt({ input, output });

  const judgeStart = performance.now();
  const { text, inputTokens, outputTokens } = await callClaude({
    system,
    messages: [{ role: 'user', content: userMessage }],
    meta: { agent: '__judge__' },
  });
  const judgeLatencyMs = Math.round(performance.now() - judgeStart);

  const parsed  = extractJSON(text);
  const result  = parseRubricResponse(parsed);
  if (!result) {
    console.warn('[judge] failed to parse rubric response for trace', agentTraceId, text.slice(0, 200));
    return;
  }

  const MODEL        = 'claude-sonnet-4-20250514';
  const judgeCostUsd = computeCostUsd(MODEL, inputTokens ?? 0, outputTokens ?? 0);

  await insertJudgeScore({
    agentTraceId,
    agent,
    rubricVersion,
    scoreOverall:  result.scoreOverall,
    breakdown:     result.breakdown,
    judgeModel:    MODEL,
    judgeTokensIn:  inputTokens  ?? 0,
    judgeTokensOut: outputTokens ?? 0,
    judgeCostUsd,
    judgeLatencyMs,
    reasoning:               result.reasoning,
  });

  if (result.scoreOverall >= GOLDEN_THRESHOLD) {
    await flagGoldenCandidate(agentTraceId, result.scoreOverall);
    console.info(`[judge] golden candidate flagged — trace ${agentTraceId}, score ${result.scoreOverall}`);
  }
}
