-- Migration: Add last_seen_at to users for "last seen" in admin UI
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).
-- last_seen_at is updated on each /me request (authenticated activity).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_seen_at IS 'Last time this user made an authenticated request (/me). Used for admin "Last seen" display.';
