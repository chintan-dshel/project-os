-- ============================================================
-- AI PROJECT OS — Base Schema (migration 000)
-- Runs first on a fresh database. migrate.js tracks applied
-- migrations in _migrations so this runs exactly once.
-- CREATE TYPE has no IF NOT EXISTS in any Postgres version;
-- idempotency is guaranteed by the migration tracker instead.
-- The constraint at the bottom of the original schema.sql is
-- handled by migration 001 and is intentionally excluded here.
-- ============================================================


-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE project_stage AS ENUM (
  'intake',
  'planning',
  'awaiting_approval',
  'execution',
  'milestone_retro',
  'ship_retro',
  'complete'
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

CREATE TABLE IF NOT EXISTS projects (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT          NOT NULL,
  one_liner         TEXT,
  project_type      project_type,
  target_user       TEXT,
  core_problem      TEXT,
  stage             project_stage NOT NULL DEFAULT 'intake',
  overall_status    project_status,

  hours_per_week    INTEGER,
  budget            TEXT,

  methodology       TEXT,
  total_estimated_hours  NUMERIC(6,1),
  planned_weeks     INTEGER,
  scope_warning     TEXT,
  plan_approved     BOOLEAN       NOT NULL DEFAULT FALSE,

  momentum_score    INTEGER CHECK (momentum_score BETWEEN 0 AND 100),
  last_checkin_at   TIMESTAMPTZ,

  confidence_score  INTEGER CHECK (confidence_score BETWEEN 0 AND 100),

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);


-- ── INTAKE AGENT OUTPUTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS success_criteria (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  criterion   TEXT  NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scope_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT    NOT NULL,
  in_scope    BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS project_skills (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill       TEXT    NOT NULL,
  available   BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS open_questions (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question    TEXT  NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);


-- ── PLANNING AGENT OUTPUTS ───────────────────────────────────

CREATE TABLE IF NOT EXISTS phases (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key   TEXT  NOT NULL,
  title       TEXT  NOT NULL,
  goal        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS milestones (
  id                UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id          UUID  NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  project_id        UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_key     TEXT  NOT NULL,
  title             TEXT  NOT NULL,
  success_condition TEXT,
  estimated_hours   NUMERIC(5,1),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  completed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    UUID          NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  project_id      UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_key        TEXT          NOT NULL,
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

CREATE TABLE IF NOT EXISTS risk_register (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID            NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  risk_key      TEXT,
  description   TEXT            NOT NULL,
  likelihood    risk_likelihood NOT NULL,
  impact        risk_impact     NOT NULL,
  risk_score    INTEGER         NOT NULL CHECK (risk_score BETWEEN 1 AND 9),
  early_signals TEXT,
  mitigation    TEXT,
  contingency   TEXT,
  owner         risk_owner      NOT NULL DEFAULT 'founder',
  status        risk_status     NOT NULL DEFAULT 'open',
  source_agent  agent_name,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_log (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_key     TEXT,
  decision         TEXT  NOT NULL,
  rationale        TEXT,
  risk_evaluation  TEXT,
  outcome          TEXT,
  decided_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scope_changes (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description      TEXT  NOT NULL,
  hours_impact     NUMERIC(5,1),
  timeline_impact  TEXT,
  risk_impact      TEXT,
  decision         TEXT  CHECK (decision IN ('add_extend', 'add_cut', 'park_v2')),
  decided_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id      UUID  REFERENCES tasks(id) ON DELETE SET NULL,
  description  TEXT  NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── RETRO AGENT OUTPUTS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS retrospectives (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id           UUID        REFERENCES milestones(id) ON DELETE SET NULL,
  retro_type             retro_type  NOT NULL,
  triggered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  estimated_hours        NUMERIC(6,1),
  actual_hours           NUMERIC(6,1),
  tasks_planned          INTEGER,
  tasks_completed        INTEGER,
  variance_notes         TEXT,

  what_worked            TEXT,
  what_created_friction  TEXT,
  what_would_you_change  TEXT,

  founder_growth_read    TEXT,

  patterns_detected      JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS retro_forward_feed (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  feed_type    TEXT  NOT NULL CHECK (feed_type IN (
                 'estimate_adjustment', 'behavioral_nudge')),
  content      TEXT  NOT NULL
);

CREATE TABLE IF NOT EXISTS retro_risk_cards (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  description  TEXT  NOT NULL,
  likelihood   risk_likelihood NOT NULL,
  impact       risk_impact     NOT NULL,
  risk_score   INTEGER         NOT NULL CHECK (risk_score BETWEEN 1 AND 9)
);

CREATE TABLE IF NOT EXISTS retro_scorecard (
  id                     UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  retro_id               UUID               NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  criterion_id           UUID               REFERENCES success_criteria(id) ON DELETE SET NULL,
  criterion_text         TEXT               NOT NULL,
  outcome                criterion_outcome  NOT NULL,
  contributing_factors   TEXT,
  what_would_change_it   TEXT
);

CREATE TABLE IF NOT EXISTS v2_backlog (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  retro_id     UUID  NOT NULL REFERENCES retrospectives(id) ON DELETE CASCADE,
  description  TEXT  NOT NULL,
  source       TEXT  CHECK (source IN ('parked_idea', 'out_of_scope', 'open_risk'))
);


-- ── CONVERSATION HISTORY ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_history (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent       agent_name        NOT NULL,
  role        conversation_role NOT NULL,
  content     TEXT              NOT NULL,
  token_count INTEGER,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);


-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_stage          ON projects (stage);
CREATE INDEX IF NOT EXISTS idx_projects_overall_status ON projects (overall_status);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON tasks (milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks (status);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones (project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_phase_id   ON milestones (phase_id);

CREATE INDEX IF NOT EXISTS idx_risk_register_project_id ON risk_register (project_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_status     ON risk_register (status);
CREATE INDEX IF NOT EXISTS idx_risk_register_risk_score ON risk_register (risk_score);

CREATE INDEX IF NOT EXISTS idx_decision_log_project_id ON decision_log (project_id);

CREATE INDEX IF NOT EXISTS idx_conv_history_project_agent   ON conversation_history (project_id, agent);
CREATE INDEX IF NOT EXISTS idx_conv_history_project_created ON conversation_history (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrospectives_project_id ON retrospectives (project_id);
CREATE INDEX IF NOT EXISTS idx_retrospectives_retro_type ON retrospectives (retro_type);

CREATE INDEX IF NOT EXISTS idx_blockers_project_resolved ON blockers (project_id, resolved);


-- ── UPDATED_AT TRIGGER ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_risk_register_updated_at ON risk_register;
CREATE TRIGGER trg_risk_register_updated_at
  BEFORE UPDATE ON risk_register
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
