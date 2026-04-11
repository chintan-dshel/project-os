-- ════════════════════════════════════════════════════════════════
-- Migration 007 — Finish what migration 005 left incomplete
--
-- Migration 005's "already applied" check was agent_registry (statement 1).
-- If 005 failed after creating agent_registry but before the remaining
-- statements, subsequent runs would skip 005 entirely.
-- This migration adds all remaining 005 objects using IF NOT EXISTS guards.
-- ════════════════════════════════════════════════════════════════

-- (a) assignment_status enum — CREATE TYPE has no IF NOT EXISTS in PG,
--     use DO block to swallow duplicate_object error
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM (
    'pending_review',
    'approved',
    'rejected',
    'running',
    'completed',
    'assigned_to_user'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- (b) Agent assignment queue
CREATE TABLE IF NOT EXISTS agent_assignments (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id            UUID              REFERENCES tasks(id) ON DELETE SET NULL,
  task_key           TEXT              NOT NULL,
  registry_agent_id  UUID              REFERENCES agent_registry(id) ON DELETE SET NULL,
  suggested_prompt   TEXT,
  user_edited_prompt TEXT,
  status             assignment_status NOT NULL DEFAULT 'pending_review',
  rejection_reason   TEXT,
  output_id          UUID              REFERENCES specialist_outputs(id) ON DELETE SET NULL,
  analysis_reason    TEXT,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_assignments_project_id_idx ON agent_assignments (project_id);
CREATE INDEX IF NOT EXISTS agent_assignments_task_id_idx    ON agent_assignments (task_id);
CREATE INDEX IF NOT EXISTS agent_assignments_status_idx     ON agent_assignments (status);

-- (c) Project archiving + analysis tracking columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archived_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_archived                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_assignment_analysis_at   TIMESTAMPTZ;

-- (d) Generated documents table
CREATE TABLE IF NOT EXISTS generated_documents (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type     TEXT  NOT NULL,
  title        TEXT  NOT NULL,
  content      TEXT  NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  milestone_id UUID  REFERENCES milestones(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS generated_documents_project_id_idx ON generated_documents (project_id);

-- (e) registry_agent_slug on specialist_outputs
ALTER TABLE specialist_outputs
  ADD COLUMN IF NOT EXISTS registry_agent_slug TEXT;
