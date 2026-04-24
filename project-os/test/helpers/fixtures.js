import { query } from './db.js';
import { createHash } from 'crypto';

export async function createTestProject(userId, overrides = {}) {
  const { rows } = await query(
    `INSERT INTO projects (user_id, title, stage)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, title, stage, plan_approved, confidence_score`,
    [
      userId,
      overrides.title ?? overrides.name ?? 'Test Project',
      overrides.stage ?? 'intake',
    ],
  );
  return rows[0];
}

export async function createTestTrace(overrides = {}) {
  const { rows } = await query(
    `INSERT INTO agent_traces
       (project_id, user_id, agent, model,
        prompt_tokens, completion_tokens,
        input_price_per_mtok, output_price_per_mtok, cost_usd,
        latency_ms, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      overrides.projectId        ?? null,
      overrides.userId           ?? null,
      overrides.agent            ?? 'intake',
      overrides.model            ?? 'claude-sonnet-4-20250514',
      overrides.promptTokens     ?? 100,
      overrides.completionTokens ?? 50,
      3.00, 15.00,
      overrides.costUsd          ?? 0.001,
      overrides.latencyMs        ?? 500,
      overrides.status           ?? 'success',
    ],
  );
  return rows[0];
}

export async function createTestVariant(experimentKey, overrides = {}) {
  const systemPrompt = overrides.systemPrompt ?? null;
  const hash = createHash('sha256').update(systemPrompt ?? '').digest('hex');
  const { rows } = await query(
    `INSERT INTO ab_variants
       (experiment_key, variant_name, agent, model, system_prompt, system_prompt_hash, traffic_weight, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, experiment_key, variant_name, agent, model, traffic_weight, active`,
    [
      experimentKey,
      overrides.variantName   ?? 'control',
      overrides.agent         ?? 'intake',
      overrides.model         ?? 'claude-sonnet-4-20250514',
      systemPrompt,
      hash,
      overrides.trafficWeight ?? 50,
      overrides.active        ?? true,
    ],
  );
  return rows[0];
}
