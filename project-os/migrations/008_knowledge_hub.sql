-- 008_knowledge_hub.sql
-- Organisational knowledge base — accumulates learnings from retros, decisions, and RAID log
-- Auto-populated by: retro completion, decision log entries, manual entries
-- Consumed by: Planning Agent and Execution Agent via relevant-entries injection

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id            SERIAL PRIMARY KEY,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_name  TEXT,                        -- denormalised for display after project is closed
  type          TEXT NOT NULL DEFAULT 'lesson_learned',
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  source_type   TEXT NOT NULL DEFAULT 'manual',  -- retro | decision_log | risk_register | manual
  source_id     INTEGER,                     -- FK to the source row (retro id, decision id, etc.)
  tags          TEXT[] DEFAULT '{}',
  search_vector TSVECTOR,                    -- populated on insert by the application
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_entries_project_id_idx  ON knowledge_entries(project_id);
CREATE INDEX IF NOT EXISTS knowledge_entries_type_idx        ON knowledge_entries(type);
CREATE INDEX IF NOT EXISTS knowledge_entries_source_idx      ON knowledge_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS knowledge_entries_search_idx      ON knowledge_entries USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS knowledge_entries_created_at_idx  ON knowledge_entries(created_at DESC);
