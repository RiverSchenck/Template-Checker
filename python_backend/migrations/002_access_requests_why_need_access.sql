-- Migration: Add why_need_access to access_requests for request access flow
-- Run in Supabase SQL Editor or via migration tool.

ALTER TABLE access_requests
ADD COLUMN IF NOT EXISTS why_need_access TEXT;

COMMENT ON COLUMN access_requests.why_need_access IS 'Optional reason provided when requesting access (required on login form submission).';
