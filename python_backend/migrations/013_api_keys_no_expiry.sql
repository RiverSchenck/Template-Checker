-- Migration: Allow API keys that never expire (expires_at NULL). Only admins can create them; the backend enforces that.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).

ALTER TABLE api_keys ALTER COLUMN expires_at DROP NOT NULL;

COMMENT ON COLUMN api_keys.expires_at IS 'When the key stops working. NULL means it never expires (admins only).';
