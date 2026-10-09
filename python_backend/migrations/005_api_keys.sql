-- Migration: Per-user API keys for calling /run and /run-and-download-xml outside the web app.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).
-- Only a SHA-256 hash of each key is stored; the plaintext is shown to the user once at creation.
-- Keys are deleted with their owner, so removing a user from the users table revokes their API access.

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- The backend uses the service role key; no client should read this table directly.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN api_keys.key_hash IS 'sha256 hex of the full key. The plaintext key is never stored.';
COMMENT ON COLUMN api_keys.key_prefix IS 'First characters of the key (e.g. tc_AbC1234), for display only.';
