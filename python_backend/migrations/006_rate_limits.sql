-- Migration: Rate limits shared by every backend machine (app/rate_limit.py).
-- Run in the Template Checker Supabase project (SQL Editor or migration tool).
--
-- rate_limit_hit:      sliding-window counter (e.g. 50 checks per user per hour, 5 access requests per IP per hour).
-- acquire/release_check_lease: "one check at a time" per user. A lease expires on its own, so a crashed or
--                      killed worker can't lock a user out for longer than the TTL.
--
-- Only the backend (service role) may use these. Postgres grants EXECUTE on new functions to PUBLIC, and Supabase
-- exposes functions over the public API, so EXECUTE is revoked from everyone else below.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id BIGSERIAL PRIMARY KEY,
    bucket TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_bucket_created_at ON rate_limit_hits(bucket, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_created_at ON rate_limit_hits(created_at);
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS check_leases (
    bucket TEXT PRIMARY KEY,
    lease_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE check_leases ENABLE ROW LEVEL SECURITY;


-- Record one hit for p_bucket if it is under p_limit in the last p_window_seconds.
-- Returns allowed, and when not allowed, how many seconds until the oldest hit leaves the window.
-- Rejected attempts are not recorded, so retrying doesn't extend the wait.
CREATE OR REPLACE FUNCTION rate_limit_hit(p_bucket TEXT, p_limit INT, p_window_seconds INT)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window INTERVAL := make_interval(secs => p_window_seconds);
    v_count INT;
    v_oldest TIMESTAMPTZ;
BEGIN
    -- Serialize hits per bucket across all machines and workers; released at commit.
    PERFORM pg_advisory_xact_lock(hashtextextended('rate_limit_hit:' || p_bucket, 0));

    -- Housekeeping: this bucket's expired hits, plus anything older than a day from buckets never hit again.
    DELETE FROM rate_limit_hits WHERE bucket = p_bucket AND created_at <= v_now - v_window;
    DELETE FROM rate_limit_hits WHERE created_at < v_now - INTERVAL '1 day';

    SELECT count(*), min(created_at) INTO v_count, v_oldest FROM rate_limit_hits WHERE bucket = p_bucket;
    IF v_count >= p_limit THEN
        RETURN QUERY SELECT false, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + v_window - v_now)))::INT);
        RETURN;
    END IF;

    INSERT INTO rate_limit_hits (bucket, created_at) VALUES (p_bucket, v_now);
    RETURN QUERY SELECT true, 0;
END;
$$;


-- Take the lease for p_bucket if it's free or expired. Returns the new lease id, or NULL if someone holds it.
CREATE OR REPLACE FUNCTION acquire_check_lease(p_bucket TEXT, p_ttl_seconds INT)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_lease_id UUID;
BEGIN
    INSERT INTO check_leases AS l (bucket, lease_id, expires_at)
    VALUES (p_bucket, gen_random_uuid(), v_now + make_interval(secs => p_ttl_seconds))
    ON CONFLICT (bucket) DO UPDATE
        SET lease_id = EXCLUDED.lease_id, expires_at = EXCLUDED.expires_at
        WHERE l.expires_at <= v_now
    RETURNING lease_id INTO v_lease_id;
    RETURN v_lease_id;
END;
$$;


-- Release a lease, only if it is still ours (an expired lease may have been taken over by a newer request).
CREATE OR REPLACE FUNCTION release_check_lease(p_bucket TEXT, p_lease_id UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
    DELETE FROM check_leases WHERE bucket = p_bucket AND lease_id = p_lease_id;
$$;


REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION acquire_check_lease(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_check_lease(TEXT, UUID) FROM PUBLIC, anon, authenticated;
-- The functions run as the caller, so the backend role needs the tables (RLS has no policies: nobody else gets rows).
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_hits, check_leases TO service_role;
GRANT USAGE ON SEQUENCE rate_limit_hits_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION acquire_check_lease(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION release_check_lease(TEXT, UUID) TO service_role;
