import { query } from './pool.js';

const DEFAULT_DAYS = 7;

function dateDefaults(from, to) {
  const toTs   = to   ? new Date(to)   : new Date();
  const fromTs = from ? new Date(from) : new Date(toTs.getTime() - DEFAULT_DAYS * 86400_000);
  return { fromTs, toTs };
}

export async function insertAgentTrace({
  projectId, userId, conversationId, agent, model,
  promptTokens, completionTokens,
  inputPricePerMtok, outputPricePerMtok, costUsd,
  latencyMs, status, errorMessage, variantId,
}) {
  const { rows } = await query(
    `INSERT INTO agent_traces
       (project_id, user_id, conversation_id, agent, model,
        prompt_tokens, completion_tokens,
        input_price_per_mtok, output_price_per_mtok, cost_usd,
        latency_ms, status, error_message, variant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      projectId   ?? null,
      userId      ?? null,
      conversationId ?? null,
      agent, model,
      promptTokens, completionTokens,
      inputPricePerMtok, outputPricePerMtok, costUsd,
      latencyMs, status, errorMessage ?? null,
      variantId ?? null,
    ],
  );
  return rows[0]?.id ?? null;
}

export async function getSummary({ projectId, userId, from, to } = {}) {
  const { fromTs, toTs } = dateDefaults(from, to);
  const { rows } = await query(
    `SELECT
       COALESCE(SUM(cost_usd), 0)::float            AS total_cost_usd,
       COUNT(*)::int                                AS total_calls,
       COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS total_tokens,
       COUNT(*) FILTER (WHERE status = 'error')::int AS error_count
     FROM agent_traces
     WHERE created_at BETWEEN $1 AND $2
       AND agent <> '__judge__'
       AND ($3::uuid IS NULL OR project_id = $3)
       AND ($4::uuid IS NULL OR user_id    = $4)`,
    [fromTs, toTs, projectId ?? null, userId ?? null],
  );
  return rows[0];
}

export async function getByAgent({ projectId, userId, from, to } = {}) {
  const { fromTs, toTs } = dateDefaults(from, to);
  const { rows } = await query(
    `SELECT
       agent,
       COUNT(*)::int                                    AS calls,
       COALESCE(SUM(cost_usd), 0)::float               AS cost_usd,
       ROUND(AVG(latency_ms))::int                     AS avg_latency_ms,
       COUNT(*) FILTER (WHERE status = 'error')::int   AS error_count
     FROM agent_traces
     WHERE created_at BETWEEN $1 AND $2
       AND agent <> '__judge__'
       AND ($3::uuid IS NULL OR project_id = $3)
       AND ($4::uuid IS NULL OR user_id    = $4)
     GROUP BY agent
     ORDER BY calls DESC`,
    [fromTs, toTs, projectId ?? null, userId ?? null],
  );
  return rows;
}

export async function getTimeseries({ projectId, userId, granularity = 'day', from, to } = {}) {
  const { fromTs, toTs } = dateDefaults(from, to);
  const trunc = granularity === 'hour' ? 'hour' : 'day';
  const { rows } = await query(
    `SELECT
       date_trunc($5, created_at AT TIME ZONE 'UTC') AS bucket,
       COUNT(*)::int                                 AS calls,
       COALESCE(SUM(cost_usd), 0)::float             AS cost_usd,
       COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS tokens
     FROM agent_traces
     WHERE created_at BETWEEN $1 AND $2
       AND agent <> '__judge__'
       AND ($3::uuid IS NULL OR project_id = $3)
       AND ($4::uuid IS NULL OR user_id    = $4)
     GROUP BY 1
     ORDER BY 1 ASC`,
    [fromTs, toTs, projectId ?? null, userId ?? null, trunc],
  );
  return rows;
}

export async function getLatencyPercentiles({ projectId, userId, from, to } = {}) {
  const { fromTs, toTs } = dateDefaults(from, to);
  const { rows } = await query(
    `SELECT
       percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)::int AS p99
     FROM agent_traces
     WHERE created_at BETWEEN $1 AND $2
       AND status = 'success'
       AND agent <> '__judge__'
       AND ($3::uuid IS NULL OR project_id = $3)
       AND ($4::uuid IS NULL OR user_id    = $4)`,
    [fromTs, toTs, projectId ?? null, userId ?? null],
  );
  return rows[0];
}

export async function getJudgeOpsSummary({ from, to } = {}) {
  const { fromTs, toTs } = dateDefaults(from, to);
  const { rows } = await query(
    `SELECT
       COUNT(*)::int                        AS total_judge_calls,
       COALESCE(SUM(cost_usd), 0)::float   AS total_judge_cost_usd,
       ROUND(AVG(latency_ms))::int         AS avg_judge_latency_ms
     FROM agent_traces
     WHERE agent = '__judge__'
       AND created_at BETWEEN $1 AND $2`,
    [fromTs, toTs],
  );
  return rows[0];
}
