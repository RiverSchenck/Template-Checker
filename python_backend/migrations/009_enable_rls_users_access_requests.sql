-- Migration: Row level security on users and access_requests.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).
--
-- 001 created these tables without RLS. Production already has it enabled (set in the dashboard), so this is
-- a no-op there; it makes sure a database rebuilt from the migrations is locked down too. Without it, the public
-- anon key shipped in the frontend could read every user and insert itself into users as an admin.
-- No policies on purpose: only the backend's service role (which bypasses RLS) reads or writes these tables.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
