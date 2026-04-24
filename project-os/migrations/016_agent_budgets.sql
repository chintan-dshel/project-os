-- 016_agent_budgets.sql
-- Per-project per-agent spend caps and a project-level kill switch.
--
-- project_agent_budgets — defines daily and monthly USD limits for each agent
--                         slug within a project. NULL limits mean uncapped.
--                         The enabled flag lets an owner disable a single agent
--                         without deleting its budget row.
--
-- agent_kill_switch — records pause/resume events for all agents on a project.
--                     A project is considered paused when the most recent row
--                     has resumed_at IS NULL. Multiple rows allow a full audit
--                     trail of who paused/resumed and why.

CREATE TABLE IF NOT EXISTS project_agent_budgets (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_slug         TEXT         NOT NULL,
  daily_limit_usd    NUMERIC(10,2),              -- NULL = no daily cap
  monthly_limit_usd  NUMERIC(10,2),              -- NULL = no monthly cap
  enabled            BOOLEAN      NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (project_id, agent_slug)
);

CREATE INDEX IF NOT EXISTS project_agent_budgets_project_id_idx
  ON project_agent_budgets (project_id);

CREATE TABLE IF NOT EXISTS agent_kill_switch (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  paused_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at  TIMESTAMPTZ,                       -- NULL = currently paused
  reason      TEXT
);

CREATE INDEX IF NOT EXISTS agent_kill_switch_project_id_idx
  ON agent_kill_switch (project_id);
