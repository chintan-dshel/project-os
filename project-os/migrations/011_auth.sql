-- 011_auth.sql
-- Minimal auth: users table + user_id on projects.
-- Projects created after this migration will be scoped to the creating user.
-- Existing projects (user_id IS NULL) remain accessible by any authenticated user
-- during the transition period.

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
