-- 013_pii_audit.sql
-- Audit log of PII detections in user input.
-- Stores only type, count, and a sha256 hash — never the PII value itself.

CREATE TABLE IF NOT EXISTS pii_events (
  id              BIGSERIAL    PRIMARY KEY,
  user_id         UUID         REFERENCES users(id) ON DELETE SET NULL,
  project_id      UUID         REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id UUID         REFERENCES conversation_history(id) ON DELETE SET NULL,
  pii_type        VARCHAR(30)  NOT NULL,
  match_count     INTEGER      NOT NULL CHECK (match_count > 0),
  message_hash    CHAR(64)     NOT NULL,
  redacted        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pii_events_user    ON pii_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pii_events_project ON pii_events(project_id);
CREATE INDEX IF NOT EXISTS idx_pii_events_created ON pii_events(created_at DESC);
