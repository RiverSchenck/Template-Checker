-- Migration: Track how a users row was created (admin invite vs access request approval).
-- Run on Template Checker Supabase (SQL Editor, MCP execute_sql, or your migration runner).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS added_via TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_added_via_check;

ALTER TABLE users
  ADD CONSTRAINT users_added_via_check
  CHECK (added_via IS NULL OR added_via IN ('invite', 'access_request'));

COMMENT ON COLUMN users.added_via IS 'invite = POST /admin/invites; access_request = approved access request. NULL = legacy or manual bootstrap.';
