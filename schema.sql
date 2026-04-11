-- ============================================================
-- AI PROJECT OS — PostgreSQL Schema
-- Supports: Intake Agent, Planning Agent, Execution Agent,
--           Retro Agent. All agents write to the same project.
-- ============================================================


-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE project_stage AS ENUM (
  'intake',        -- Intake Agent active; brief being built
  'planning',      -- Planning Agent active; plan being generated
  'awaiting_approval',  -- Plan generated; waiting for founder CONFIRMED
  'execution',     -- Execution Agent active; tasks being worked
  'milestone_retro',    -- Retro Agent active after a milestone
  'ship_retro',    -- Retro Agent active at final ship
  'complete'       -- Project closed
);

CREATE TYPE project_status AS ENUM (
  'on_track',
  'at_risk',
  'blocked'
);

CREATE TYPE project_type AS ENUM (
  'saas', 'app', 'content', 'service', 'hardware', 'research', 'other'
);

CREATE TYPE task_status AS ENUM (
  'todo', 'in_progress', 'done', 'blocked'
);

CREATE TYPE priority_level AS ENUM (
  'critical', 'high', 'normal'
);

CREATE TYPE risk_likelihood AS ENUM ('low', 'medium', 'high');
CREATE TYPE risk_impact     AS ENUM ('low', 'medium', 'high');

CREATE TYPE risk_status AS ENUM (
  'open', 'mitigated', 'accepted', 'closed'
);

CREATE TYPE risk_owner AS ENUM (
  'founder', 'agent', 'external'
);

CREATE TYPE retro_type AS ENUM (
  'milestone_retro', 'ship_retro'
);

CREATE TYPE criterion_outcome AS ENUM (
  'met', 'partially_met', 'not_met'
);

CREATE TYPE conversation_role AS ENUM (
  'user', 'assistant', 'system'
);

CREATE TYPE agent_name AS ENUM (
  'intake', 'planning', 'execution', 'retro'
);


-- ── CORE: PROJECTS ───────────────────────────────────────────

CREATE TABLE projects (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT          NOT NULL,
  one_liner         TEXT,
  project_type      project_type,
  target_user       TEXT,
  core_problem      TEXT,
  stage             project_stage NOT NULL DEFAULT 'intake',
  overall_status    project_status,

  -- Constraints (from Intake Agent brief)
  hours_per_week    INTEGER,
  budget            TEXT,

  -- Planning metadata (from Planning Agent)
  methodology       TEXT,
  total_estimated_hours  NUMERIC(6,1),
  planned_weeks     INTEGER,
  scope_warning     TEXT,
  plan_approved     BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Execution metadata (from Execution Agent)
  momentum_score    INTEGER CHECK (momentum_score BETWEEN 0 AND 100),
  last_checkin_at   TIMESTAMPTZ,

  -- Brief quality signal
  confidence_score  INTEGER CHECK (confidence_score BETWEEN 0 AND 100),

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);


-- ── INTAKE AGENT OUTPUTS ─────────────────────────────────────

-- Success criteria (array in JSON → normalised rows)
CREATE TABLE success_criteria (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  criterion   TEXT  NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- v1 scope items
CREATE TABLE scope_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT    NOT NULL,
  in_scope    BOOLEAN NOT NULL   -- TRUE = in_scope, FALSE = out_of_scope
);

-- Skills inventory (skills_available + skills_needed)
CREATE TABLE project_skills (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill       TEXT    NOT NULL,
  available   BOOLEAN NOT NULL   -- TRUE = founder has it, FALSE = needs it
);

-- Open questions left by Intake Agent
CREATE TABLE open_questions (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question    TEXT  NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);


-- ── PLANNING AGENT OUTPUTS ───────────────────────────────────

CREATE TABLE phases (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key   TEXT  NOT NULL,   -- e.g. "phase_1", from the agent's id field
  title       TEXT  NOT NULL,
  goal        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE milestones (
  id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id          UUID  NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  project_id        UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_key     TEXT  NOT NULL,   -- agent's id field
  title             TEXT  NOT NULL,
  success_condition TEXT,
  estimated_hours   NUMERIC(5,1),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  completed_at      TIMESTAMPTZ
);

CREATE TABLE tasks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    UUID          NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  project_id      UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_key        TEXT          NOT NULL,   -- agent's id field
  title           TEXT          NOT NULL,
  description     TEXT,
  estimated_hours NUMERIC(4,1),
  actual_hours    NUMERIC(4,1),
  priority        priority_level NOT NULL DEFAULT 'normal',
  status          task_status    NOT NULL DEFAULT 'todo',
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);


-- ── EXECUTION AGENT OUTPUTS ──────────────────────────────────

CREATE TABLE risk_register (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_key      TEXT,           -- agent's id field if provided
  description   TEXT            NOT NULL,
  likelihood    risk_likelihood NOT NULL,
  impact        risk_impact     NOT NULL,
  risk_score    INTEGER         NOT NULL CHECK (risk_score BETWEEN 1 AND 9),
  early_signals TEXT,
  mitigation    TEXT,
  contingency   TEXT,
  owner         risk_owner      NOT NULL DEFAULT 'founder',
  status        risk_status     NOT NULL DEFAULT 'open',
  source_agent  agent_name,     -- which agent raised this risk
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE decision_log (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_key     TEXT,         -- agent's id field
  decision         TEXT  NOT NULL,
  rationale        TEXT,
  risk_evaluation  TEXT,
  outcome          TEXT,         -- filled in retrospectively
  decided_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE scope_changes (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description      TEXT  NOT NULL,
  hours_impact     NUMERIC(5,1),
  timeline_impact  TEXT,
  risk_impact      TEXT,
  decision         TEXT  CHECK (decision IN ('add_extend', 'add_cut', 'park_v2')),
  decided_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE blockers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id      UUID  REFERENCES tasks(id) ON DELETE SET NULL,
  description  TEXT  NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── RETRO AGENT OUTPUTS ──────────────────────────────────────

CREATE TABLE retrospectives (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id           UUID        REFERENCES milestones(id) ON DELETE SET NULL,
  retro_type             retro_type  NOT NULL,
  triggered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Planned vs actual
  estimated_hours        NUMERIC(6,1),
  actual_hours           NUMERIC(6,1),
  tasks_planned          INTEGER,
  tasks_completed        INTEGER,
  variance_notes         TEXT,

  -- Three core questions
  what_worked            TEXT,
  what_created_friction  TEXT,
  what_would_you_change  TEXT,

  -- Ship retro extras
  founder_growth_read    TEXT,

  -- Free-form patterns detected (stored as JSONB array of strings)
  patterns_detected      JSONB NOT NULL DEFAULT '[]'
);

-- Forward feed items (estimate adjustments, nudges)
CREATE TABLE retro_forward_feed (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  feed_type    TEXT  NOT NULL CHECK (feed_type IN (
                 'estimate_adjustment', 'behavioral_nudge')),
  content      TEXT  NOT NULL
);

-- New risk cards raised by a retro (separate from the main risk_register
-- so we can track provenance, then merge into risk_register for execution)
CREATE TABLE retro_risk_cards (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  description  TEXT  NOT NULL,
  likelihood   risk_likelihood NOT NULL,
  impact       risk_impact     NOT NULL,
  risk_score   INTEGER         NOT NULL CHECK (risk_score BETWEEN 1 AND 9)
);

-- Scorecard rows (ship_retro only)
CREATE TABLE retro_scorecard (
  id                     UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id               UUID               NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  criterion_id           UUID               REFERENCES success_criteria(id) ON DELETE SET NULL,
  criterion_text         TEXT               NOT NULL,  -- snapshot at retro time
  outcome                criterion_outcome  NOT NULL,
  contributing_factors   TEXT,
  what_would_change_it   TEXT
);

-- v2 backlog harvested at ship retro
CREATE TABLE v2_backlog (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  description  TEXT  NOT NULL,
  source       TEXT  CHECK (source IN ('parked_idea', 'out_of_scope', 'open_risk'))
);


-- ── CONVERSATION HISTORY ─────────────────────────────────────

CREATE TABLE conversation_history (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent       agent_name        NOT NULL,
  role        conversation_role NOT NULL,
  content     TEXT              NOT NULL,
  token_count INTEGER,          -- optional, for cost tracking
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);


-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX ON projects (stage);
CREATE INDEX ON projects (overall_status);

CREATE INDEX ON tasks (project_id);
CREATE INDEX ON tasks (milestone_id);
CREATE INDEX ON tasks (status);

CREATE INDEX ON milestones (project_id);
CREATE INDEX ON milestones (phase_id);

CREATE INDEX ON risk_register (project_id);
CREATE INDEX ON risk_register (status);
CREATE INDEX ON risk_register (risk_score);

CREATE INDEX ON decision_log (project_id);

CREATE INDEX ON conversation_history (project_id, agent);
CREATE INDEX ON conversation_history (project_id, created_at DESC);

CREATE INDEX ON retrospectives (project_id);
CREATE INDEX ON retrospectives (retro_type);

CREATE INDEX ON blockers (project_id, resolved);


-- ── UPDATED_AT TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_risk_register_updated_at
  BEFORE UPDATE ON risk_register
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── MIGRATION 001 (bundled) ───────────────────────────────────────────────────
-- Required for the ON CONFLICT upsert in tasks to work.

ALTER TABLE tasks
  ADD CONSTRAINT IF NOT EXISTS tasks_project_task_key_unique
  UNIQUE (project_id, task_key);
