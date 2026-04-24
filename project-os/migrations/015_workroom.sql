-- 015_workroom.sql
-- Project Workroom: activity log (timeline) and persistent agent chat per project.
--
-- log_entries  — append-only event stream for everything that happens in a project
--                (user actions, agent outputs, system events). The delta_summary
--                field holds a pre-computed human-readable diff ("+1d on BR-43 ·
--                no M2 impact") so the timeline renders without extra queries.
--
-- chat_threads — one row per (project, agent) pair; acts as the persistent session
--                anchor so conversation history survives page reloads.
--
-- chat_messages — individual turns in a chat thread, including side-effects
--                 (mutations the agent performed) encoded as JSONB.

CREATE TABLE IF NOT EXISTS log_entries (
  id            BIGSERIAL   PRIMARY KEY,
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind          TEXT        NOT NULL DEFAULT 'user'
                CHECK (kind IN ('user', 'agent', 'system')),
  author        TEXT,                              -- display name (denormalised)
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  body          TEXT        NOT NULL,
  delta_summary TEXT,                              -- e.g. "+1d on BR-43 · no M2 impact"
  source_ref    TEXT,                              -- card/decision/risk ID for deep-linking
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS log_entries_project_id_created_at_idx
  ON log_entries (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_threads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_name  TEXT        NOT NULL DEFAULT 'planner',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, agent_name)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGSERIAL   PRIMARY KEY,
  thread_id   UUID        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'user'
              CHECK (role IN ('user', 'agent')),
  body        TEXT        NOT NULL,
  agent_name  TEXT,                               -- populated when role = 'agent'
  side_effects JSONB      NOT NULL DEFAULT '[]',  -- mutations performed by the agent
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_id_created_at_idx
  ON chat_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_project_id_idx
  ON chat_messages (project_id);
