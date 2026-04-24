-- 022_routing.sql
-- Routing decision log (what model was chosen and why) + rate limit observability.

CREATE TABLE IF NOT EXISTS routing_decisions (
  id             BIGSERIAL    PRIMARY KEY,
  agent_trace_id BIGINT       REFERENCES agent_traces(id) ON DELETE CASCADE,
  agent          VARCHAR(50)  NOT NULL,
  stage          VARCHAR(50),
  inputs         JSONB        NOT NULL,              -- { complexityTokens, projectSize, ... }
  chosen_model   VARCHAR(100) NOT NULL,
  rule_fired     VARCHAR(100) NOT NULL,              -- e.g. 'retro-default-haiku'
  fallback_chain TEXT[]       NOT NULL DEFAULT '{}', -- models tried in order on retry
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_trace ON routing_decisions(agent_trace_id);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_rule  ON routing_decisions(rule_fired);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id                    BIGSERIAL   PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_name           VARCHAR(10) NOT NULL,        -- 'hour' | 'day'
  window_max            INTEGER     NOT NULL,
  used                  INTEGER     NOT NULL,
  retry_after_seconds   INTEGER     NOT NULL,
  path                  VARCHAR(200),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user    ON rate_limit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created ON rate_limit_events(created_at DESC);
