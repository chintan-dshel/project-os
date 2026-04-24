-- 014_brief_versions.sql
-- Project Brief versioning.
-- Each project has at most one `briefs` row (created lazily on first save).
-- Every save creates a new `brief_versions` snapshot so the full edit history
-- is preserved. The parent row tracks the current version number for fast
-- reads without a MAX() subquery.

CREATE TABLE IF NOT EXISTS briefs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_version INT         NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS brief_versions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    UUID        NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version     INT         NOT NULL,
  sections    JSONB       NOT NULL DEFAULT '[]',  -- [{n:'01', title:'Problem & context', body:'...'}]
  author_kind TEXT        NOT NULL DEFAULT 'human'
              CHECK (author_kind IN ('human', 'agent')),
  agent_name  TEXT,                               -- NULL when author_kind = 'human'
  change_note TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brief_id, version)
);

CREATE INDEX IF NOT EXISTS brief_versions_brief_id_version_idx
  ON brief_versions (brief_id, version DESC);

CREATE INDEX IF NOT EXISTS brief_versions_project_id_idx
  ON brief_versions (project_id);
