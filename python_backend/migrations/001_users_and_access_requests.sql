-- Migration: Add users and access_requests tables for invite-only access
-- Run this in the Template Checker Supabase project (SQL Editor or migration tool).
-- After running, bootstrap first admin: INSERT INTO users (email, role) VALUES ('your-email@example.com', 'admin');

-- Users table: approved users + role + cached Google name/picture
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    display_name TEXT,
    avatar_url TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Access requests: requested but not yet approved
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    decided_by UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
