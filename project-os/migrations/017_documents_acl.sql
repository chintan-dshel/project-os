-- 017_documents_acl.sql
-- Add ACL (access-control level) and normalised kind columns to the two
-- document tables created in migrations 009 and 007.
--
-- acl values:
--   'everyone' — all project members can read
--   'core'     — core team only (owners + invited collaborators)
--   'owner'    — project owner only
--
-- kind on workspace_docs mirrors the existing `type` column but uses
-- UPPER-CASE tokens to match the convention used elsewhere in the UI.
-- The back-fill below converts existing rows in a single pass: any row
-- whose type is not 'note' gets UPPER(type), 'note' rows stay 'NOTE'.

ALTER TABLE workspace_docs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'NOTE',
  ADD COLUMN IF NOT EXISTS acl  TEXT NOT NULL DEFAULT 'everyone'
    CHECK (acl IN ('everyone', 'core', 'owner'));

ALTER TABLE generated_documents
  ADD COLUMN IF NOT EXISTS acl  TEXT NOT NULL DEFAULT 'everyone'
    CHECK (acl IN ('everyone', 'core', 'owner'));

-- Back-fill kind from the existing type column.
UPDATE workspace_docs
  SET kind = UPPER(type)
  WHERE kind = 'NOTE' AND type IS NOT NULL AND type <> 'note';

UPDATE workspace_docs
  SET kind = 'NOTE'
  WHERE kind = 'NOTE' AND (type IS NULL OR type = 'note');
