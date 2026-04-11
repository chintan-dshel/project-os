-- Migration 002: Performance indexes
-- Run this once against your project_os database:
--   psql project_os -U postgres -f migrations/002_performance_indexes.sql

-- Phases query filters by project_id (already indexed) — nothing new needed

-- Milestones: queried by project_id AND phase_id
CREATE INDEX IF NOT EXISTS milestones_project_id_idx  ON milestones (project_id);
CREATE INDEX IF NOT EXISTS milestones_phase_id_idx    ON milestones (phase_id);

-- Tasks: queried by project_id AND milestone_id, ordered by created_at
CREATE INDEX IF NOT EXISTS tasks_project_id_idx       ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_milestone_id_idx     ON tasks (milestone_id);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx       ON tasks (created_at);

-- Risk register: queried by project_id, ordered by risk_score DESC
CREATE INDEX IF NOT EXISTS risk_project_score_idx
  ON risk_register (project_id, risk_score DESC);

-- Decision log: queried by project_id, ordered by decided_at
CREATE INDEX IF NOT EXISTS decision_project_date_idx
  ON decision_log (project_id, decided_at);

-- Blockers: queried by project_id WHERE resolved = false
CREATE INDEX IF NOT EXISTS blockers_project_unresolved_idx
  ON blockers (project_id) WHERE resolved = false;

-- Conversation history: queried by project_id + agent, ordered by created_at
CREATE INDEX IF NOT EXISTS conv_project_agent_time_idx
  ON conversation_history (project_id, agent, created_at ASC);
