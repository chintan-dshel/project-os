-- ════════════════════════════════════════════════════════════════
-- Migration 003 — RAID Log
-- Adds: entry_type to risk_register, issue tracking, linkage
-- All changes are additive — safe for existing data
-- ════════════════════════════════════════════════════════════════

-- 1. Add entry_type to risk_register (risk | assumption)
--    Existing rows with ASSUMPTION: prefix → assumption
--    Everything else → risk
ALTER TABLE risk_register
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'risk'
    CHECK (entry_type IN ('risk', 'assumption'));

-- Migrate existing ASSUMPTION: rows
UPDATE risk_register
  SET entry_type = 'assumption'
  WHERE description LIKE 'ASSUMPTION:%';

-- 2. Add 'materialised' to risk_status enum (issues that became real)
ALTER TYPE risk_status ADD VALUE IF NOT EXISTS 'materialised';

-- 3. Add issue tracking columns to risk_register
--    When a risk materialises, issue_description captures actual impact
ALTER TABLE risk_register
  ADD COLUMN IF NOT EXISTS issue_description TEXT,
  ADD COLUMN IF NOT EXISTS materialised_at   TIMESTAMPTZ;

-- 4. Add source linkage to decision_log
--    A decision can be linked to the risk/issue that triggered it
ALTER TABLE decision_log
  ADD COLUMN IF NOT EXISTS source_risk_id UUID REFERENCES risk_register(id) ON DELETE SET NULL;

-- 5. Add source linkage to tasks
--    A task (action) can be linked to the decision that created it
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_decision_id UUID REFERENCES decision_log(id) ON DELETE SET NULL;

-- 6. Issues table — a materialised risk becomes an issue (view for clarity)
CREATE OR REPLACE VIEW raid_issues AS
  SELECT
    r.id,
    r.project_id,
    r.description          AS risk_description,
    r.issue_description,
    r.risk_score,
    r.likelihood,
    r.impact,
    r.mitigation,
    r.contingency,
    r.owner,
    r.materialised_at,
    r.created_at,
    r.updated_at
  FROM risk_register r
  WHERE r.status = 'materialised'
    AND r.entry_type = 'risk';

-- Indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_decision_log_source_risk ON decision_log(source_risk_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source_decision    ON tasks(source_decision_id);
