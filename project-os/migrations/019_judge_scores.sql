-- 019_judge_scores.sql
-- Production LLM judge scores, one row per sampled agent_traces row.
-- Not every trace gets judged (sampling via JUDGE_SAMPLE_RATE env var).

CREATE TABLE IF NOT EXISTS judge_scores (
  id              BIGSERIAL    PRIMARY KEY,
  agent_trace_id  BIGINT       NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
  agent           VARCHAR(50)  NOT NULL,
  rubric_version  VARCHAR(20)  NOT NULL,           -- e.g. 'intake-v1', tracks rubric evolution
  score_overall   NUMERIC(3,2) NOT NULL CHECK (score_overall BETWEEN 1 AND 5),
  score_breakdown JSONB        NOT NULL,            -- { inference_quality: {score,reason}, ... }
  judge_model     VARCHAR(100) NOT NULL,
  judge_tokens_in  INTEGER     NOT NULL,
  judge_tokens_out INTEGER     NOT NULL,
  judge_cost_usd   NUMERIC(12,6) NOT NULL,
  judge_latency_ms INTEGER     NOT NULL,
  reasoning       TEXT,                             -- overall.summary from the rubric
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (agent_trace_id)                           -- idempotent: one judgment per trace
);

CREATE INDEX IF NOT EXISTS idx_judge_scores_trace   ON judge_scores(agent_trace_id);
CREATE INDEX IF NOT EXISTS idx_judge_scores_agent   ON judge_scores(agent);
CREATE INDEX IF NOT EXISTS idx_judge_scores_created ON judge_scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judge_scores_overall ON judge_scores(score_overall);
