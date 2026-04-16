-- Migration 010: SMART scoring + change_requests
-- Adds SMART dimension columns to success_criteria for research study scoring.
-- Creates change_requests table for formal scope change tracking.

-- ── success_criteria: SMART dimension columns ──────────────────────────────────

ALTER TABLE success_criteria
  ADD COLUMN IF NOT EXISTS smart_specific   SMALLINT CHECK (smart_specific   BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS smart_measurable SMALLINT CHECK (smart_measurable BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS smart_achievable SMALLINT CHECK (smart_achievable BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS smart_relevant   SMALLINT CHECK (smart_relevant   BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS smart_timebound  SMALLINT CHECK (smart_timebound  BETWEEN 0 AND 2);

-- Computed total (max 10); NULL when no scores recorded yet.
ALTER TABLE success_criteria
  ADD COLUMN IF NOT EXISTS smart_score SMALLINT GENERATED ALWAYS AS (
    COALESCE(smart_specific,   0) +
    COALESCE(smart_measurable, 0) +
    COALESCE(smart_achievable, 0) +
    COALESCE(smart_relevant,   0) +
    COALESCE(smart_timebound,  0)
  ) STORED;

-- ── change_requests ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS change_requests (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description        TEXT        NOT NULL,
  change_type        TEXT        NOT NULL
                       CHECK (change_type IN (
                         'add_scope', 'remove_scope', 'modify_scope',
                         'extend_timeline', 'cut_scope'
                       )),
  timeline_impact    TEXT,
  effort_impact      TEXT,
  risk_impact        TEXT,
  decision           TEXT
                       CHECK (decision IN ('approved', 'rejected', 'parked')),
  decision_rationale TEXT,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS change_requests_project_id_idx ON change_requests (project_id);
