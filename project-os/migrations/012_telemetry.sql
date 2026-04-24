-- 012_telemetry.sql
-- Per-call LLM telemetry. Populated by callClaude() instrumentation.
-- Cost is snapshotted at write time — do NOT recompute via current pricing at read time.

CREATE TABLE IF NOT EXISTS agent_traces (
  id              BIGSERIAL    PRIMARY KEY,
  project_id      UUID         REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID         REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID         REFERENCES conversation_history(id) ON DELETE SET NULL,
  agent           VARCHAR(50)  NOT NULL,
  model           VARCHAR(100) NOT NULL,
  prompt_tokens       INTEGER  NOT NULL CHECK (prompt_tokens >= 0),
  completion_tokens   INTEGER  NOT NULL CHECK (completion_tokens >= 0),
  input_price_per_mtok  NUMERIC(10, 4) NOT NULL,
  output_price_per_mtok NUMERIC(10, 4) NOT NULL,
  cost_usd              NUMERIC(12, 6) NOT NULL,
  latency_ms            INTEGER        NOT NULL CHECK (latency_ms >= 0),
  status                VARCHAR(20)    NOT NULL DEFAULT 'success',
  error_message         TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_traces_project   ON agent_traces(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_user      ON agent_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created   ON agent_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent     ON agent_traces(agent);
CREATE INDEX IF NOT EXISTS idx_agent_traces_proj_time ON agent_traces(project_id, created_at DESC);
