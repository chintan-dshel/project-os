-- 021_ab_testing.sql
-- A/B variant registry, project-level sticky assignments, per-call tagging.
-- system_prompt TEXT stored directly on ab_variants (hash kept for dedup/logging).

CREATE TABLE IF NOT EXISTS ab_variants (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key       VARCHAR(80)  NOT NULL,
  variant_name         VARCHAR(40)  NOT NULL,
  agent                VARCHAR(50)  NOT NULL,
  model                VARCHAR(100) NOT NULL,
  system_prompt        TEXT,                          -- full prompt text used at runtime
  system_prompt_hash   VARCHAR(64)  NOT NULL,         -- sha256 of system_prompt for dedup/logging
  temperature          NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  config               JSONB        NOT NULL DEFAULT '{}',
  active               BOOLEAN      NOT NULL DEFAULT TRUE,
  traffic_weight       INTEGER      NOT NULL DEFAULT 50 CHECK (traffic_weight BETWEEN 0 AND 100),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (experiment_key, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_ab_variants_experiment ON ab_variants(experiment_key);
CREATE INDEX IF NOT EXISTS idx_ab_variants_active     ON ab_variants(active);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id             BIGSERIAL    PRIMARY KEY,
  project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  experiment_key VARCHAR(80)  NOT NULL,
  variant_id     UUID         NOT NULL REFERENCES ab_variants(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, experiment_key)                -- sticky: one variant per project per experiment
);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_project    ON ab_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment ON ab_assignments(experiment_key);

-- Tag every agent_traces row with which variant served it (NULL = no active experiment)
ALTER TABLE agent_traces
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES ab_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_traces_variant ON agent_traces(variant_id);
