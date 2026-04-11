-- ════════════════════════════════════════════════════════════════
-- Migration 005 — Agent Registry, Assignment Queue, Generated Docs, Archiving
-- All changes are additive — safe for existing data
-- ════════════════════════════════════════════════════════════════

-- (a) Agent Registry — extensible agent catalog with prompt templates
CREATE TABLE agent_registry (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT    NOT NULL,
  slug                   TEXT    NOT NULL UNIQUE,
  description            TEXT,
  system_prompt_template TEXT    NOT NULL,
  input_schema           JSONB,
  output_format          TEXT    NOT NULL DEFAULT 'markdown'
                           CHECK (output_format IN ('markdown', 'code', 'json')),
  icon                   TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: migrate original 4 hardcoded specialist types into registry
INSERT INTO agent_registry (name, slug, description, system_prompt_template, output_format, icon) VALUES
(
  'Coding Agent', 'coding',
  'Writes clean, production-ready implementation code',
  'You are an expert software engineer. Your job is to write clean, production-ready code for the following task.

Task: {{task_title}}
Description: {{task_description}}
Project context: {{project_brief}}

Requirements:
- Write complete, working code — no pseudocode or placeholders
- Use modern patterns and best practices for the inferred stack
- Include error handling where appropriate
- Add brief inline comments only where logic is non-obvious
- Format all code in fenced blocks with the correct language tag',
  'code', '⌨'
),
(
  'Research Agent', 'research',
  'Gathers and synthesises information to inform decisions',
  'You are an expert researcher. Synthesise authoritative information on the following topic.

Task: {{task_title}}
Description: {{task_description}}
Project context: {{project_brief}}

Requirements:
- Prioritise accuracy over comprehensiveness
- Structure findings clearly with markdown headers
- Include specific recommendations, not just facts
- Note caveats and conflicting evidence where relevant
- End with a concise "Bottom line" recommendation',
  'markdown', '🔍'
),
(
  'Content Agent', 'content',
  'Writes copy, documentation, emails, and blog posts',
  'You are an expert copywriter and technical writer. Produce content for the following task.

Task: {{task_title}}
Description: {{task_description}}
Project context: {{project_brief}}

Requirements:
- Match tone to the audience (infer from context)
- No filler phrases or hollow corporate speak
- Direct, clear, and purposeful writing
- Use headers if long-form content
- Deliver the content itself, not a description of what you will write',
  'markdown', '✍'
),
(
  'QA Agent', 'qa',
  'Reviews code or content for issues, edge cases, and improvements',
  'You are an expert QA reviewer. Critically review the following.

Task: {{task_title}}
Description: {{task_description}}
Project context: {{project_brief}}

Requirements:
- Be honest and specific about issues found
- Categorise findings: Critical (must fix) / Major (should fix) / Minor (nice to have)
- For code: check logic, error handling, security, and edge cases
- For content: check accuracy, clarity, tone, and completeness
- End with an overall assessment and top priority list',
  'markdown', '🔎'
);

-- (b) Assignment queue — tracks auto-suggested agent assignments per task
CREATE TYPE assignment_status AS ENUM (
  'pending_review',   -- created by analysis, awaiting founder approval
  'approved',         -- founder approved, ready to run
  'rejected',         -- founder rejected
  'running',          -- agent is currently executing
  'completed',        -- agent finished; output_id populated
  'assigned_to_user'  -- no suitable agent found; human must do this
);

CREATE TABLE agent_assignments (
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
  analysis_reason    TEXT,             -- why this agent was chosen (or why assigned_to_user)
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX ON agent_assignments (project_id);
CREATE INDEX ON agent_assignments (task_id);
CREATE INDEX ON agent_assignments (status);

-- (c) Project archiving columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS archived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_assignment_analysis_at TIMESTAMPTZ;

-- (d) Generated documents — Claude-synthesised, persistently stored reports
CREATE TABLE generated_documents (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type     TEXT  NOT NULL,   -- brief | plan | milestone-report | close-report
  title        TEXT  NOT NULL,
  content      TEXT  NOT NULL,   -- markdown
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  milestone_id UUID  REFERENCES milestones(id) ON DELETE SET NULL
);

CREATE INDEX ON generated_documents (project_id);

-- (e) Add registry_agent_slug to specialist_outputs for registry-based runs
ALTER TABLE specialist_outputs
  ADD COLUMN IF NOT EXISTS registry_agent_slug TEXT;
