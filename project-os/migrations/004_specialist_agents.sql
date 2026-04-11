-- ════════════════════════════════════════════════════════════════
-- Migration 004 — Specialist Agent Marketplace
-- Adds: specialist_outputs table, delegation tracking
-- All changes are additive — safe for existing data
-- ════════════════════════════════════════════════════════════════

CREATE TYPE specialist_type AS ENUM (
  'coding',    -- writes code for implementation tasks
  'research',  -- gathers and synthesises information
  'content',   -- writes copy, docs, blog posts
  'qa'         -- reviews output for quality and issues
);

CREATE TYPE specialist_status AS ENUM (
  'pending',          -- triggered, not yet complete
  'complete',         -- output generated, awaiting review
  'approved',         -- founder accepted the output
  'rejected',         -- founder rejected, needs revision
  'revised'           -- specialist revised after rejection
);

CREATE TABLE specialist_outputs (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id         UUID              REFERENCES tasks(id) ON DELETE SET NULL,
  task_key        TEXT,             -- denormalised for easier lookup
  specialist_type specialist_type  NOT NULL,
  brief           TEXT              NOT NULL,  -- what the specialist was asked to do
  output          TEXT,                        -- what the specialist produced
  output_format   TEXT DEFAULT 'markdown',     -- markdown | code | text
  language        TEXT,                        -- for code outputs: js, python, sql, etc.
  status          specialist_status NOT NULL DEFAULT 'pending',
  review_notes    TEXT,                        -- founder feedback on rejection
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX ON specialist_outputs (project_id);
CREATE INDEX ON specialist_outputs (task_id);
CREATE INDEX ON specialist_outputs (status);
