-- 018_integrations.sql
-- Per-user third-party integration connections.
-- One row per (user, integration key). Rows are created by the API on first
-- use via an upsert — no seed data is inserted here because user_id is unknown
-- at migration time.
--
-- status values:
--   'available'  — integration exists but the user has not connected it yet
--   'connected'  — OAuth / token exchange succeeded
--   'error'      — last sync or token refresh failed (see last_error)
--
-- config stores provider-specific data (access token, refresh token, scopes,
-- selected workspace/org, etc.) as opaque JSONB so each integration can carry
-- whatever it needs without schema changes.

CREATE TABLE IF NOT EXISTS integrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key           TEXT        NOT NULL
                CHECK (key IN ('github', 'linear', 'slack', 'notion', 'figma',
                               'salesforce', 'jira', 'gdrive')),
  status        TEXT        NOT NULL DEFAULT 'available'
                CHECK (status IN ('connected', 'error', 'available')),
  display_name  TEXT,                             -- e.g. "org/projectos · 12 repos"
  config        JSONB       NOT NULL DEFAULT '{}',
  last_sync_at  TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS integrations_user_id_idx
  ON integrations (user_id);
