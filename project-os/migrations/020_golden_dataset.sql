-- 020_golden_dataset.sql
-- Curated eval cases, run results, and shadow-eval candidates.

CREATE TABLE IF NOT EXISTS golden_cases (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  agent           VARCHAR(50)  NOT NULL,
  stage           VARCHAR(50),
  input_payload   JSONB        NOT NULL,
  expected_shape  JSONB,
  min_judge_score NUMERIC(3,2) NOT NULL DEFAULT 3.5 CHECK (min_judge_score BETWEEN 1 AND 5),
  tags            TEXT[]       NOT NULL DEFAULT '{}',
  source          VARCHAR(30)  NOT NULL,            -- 'hand-curated' | 'promoted-from-prod'
  source_trace_id BIGINT       REFERENCES agent_traces(id) ON DELETE SET NULL,
  notes           TEXT,
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golden_cases_agent  ON golden_cases(agent);
CREATE INDEX IF NOT EXISTS idx_golden_cases_active ON golden_cases(active);

CREATE TABLE IF NOT EXISTS golden_runs (
  id              BIGSERIAL    PRIMARY KEY,
  run_id          UUID         NOT NULL,
  case_id         UUID         NOT NULL REFERENCES golden_cases(id) ON DELETE CASCADE,
  git_sha         VARCHAR(40),
  model           VARCHAR(100) NOT NULL,
  variant_id      UUID,                             -- populated when run under an A/B variant
  actual_output   TEXT         NOT NULL,
  judge_score     NUMERIC(3,2) NOT NULL,
  judge_breakdown JSONB,
  passed          BOOLEAN      NOT NULL,
  tokens_in       INTEGER      NOT NULL,
  tokens_out      INTEGER      NOT NULL,
  cost_usd        NUMERIC(12,6) NOT NULL,
  latency_ms      INTEGER      NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golden_runs_run     ON golden_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_golden_runs_case    ON golden_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_golden_runs_created ON golden_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS golden_candidates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_trace_id  BIGINT       NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
  judge_score     NUMERIC(3,2) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | promoted | rejected
  reviewed_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (agent_trace_id)
);

CREATE INDEX IF NOT EXISTS idx_golden_candidates_status ON golden_candidates(status);
