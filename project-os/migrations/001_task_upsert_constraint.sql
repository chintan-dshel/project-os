-- Migration: 001_task_upsert_constraint.sql
-- Required for the ON CONFLICT upsert in tasks to work.
-- Run this after schema.sql if you applied it already.

ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_task_key_unique
  UNIQUE (project_id, task_key);
