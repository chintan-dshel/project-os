-- 009_workspace.sql
-- Project Workspace — freeform document storage for users and agents.
-- Every project gets its own workspace where:
--   - Founders write notes, specs, research, reference docs
--   - Agents (specialist/registry) save their work products automatically
--   - Entries can be promoted to the org Knowledge Hub

CREATE TABLE IF NOT EXISTS workspace_docs (
  id           SERIAL PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'note'
               CHECK (type IN ('note', 'research', 'spec', 'code', 'report', 'agent_output', 'reference')),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  task_key     TEXT,                         -- which task this doc is linked to (nullable)
  task_title   TEXT,                         -- denormalised for display
  created_by   TEXT NOT NULL DEFAULT 'user'
               CHECK (created_by IN ('user', 'agent')),
  agent_slug   TEXT,                         -- which agent produced this (nullable)
  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_docs_project_id_idx ON workspace_docs(project_id);
CREATE INDEX IF NOT EXISTS workspace_docs_type_idx        ON workspace_docs(project_id, type);
CREATE INDEX IF NOT EXISTS workspace_docs_task_key_idx    ON workspace_docs(project_id, task_key);
CREATE INDEX IF NOT EXISTS workspace_docs_updated_at_idx  ON workspace_docs(project_id, updated_at DESC);
