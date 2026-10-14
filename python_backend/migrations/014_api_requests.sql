-- Migration: Log every request made with an API key, for the admin-only API usage page.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool), BEFORE deploying the backend that
-- writes api_requests (until then the inserts fail; that is logged and never fails the request).
--
-- One row per request whose Authorization is an API key (tc_...), valid or not: which key and endpoint, the HTTP
-- status and error code, how long the whole request took, and the run it started (if any). Requests rejected
-- before a run (bad key, missing file, rate limit) are recorded too, which `runs` never sees.

CREATE TABLE IF NOT EXISTS api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status_code INT NOT NULL,
    error_code TEXT,
    duration_ms INT,
    request_bytes BIGINT,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    request_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_api_requests_key_id ON api_requests(key_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_user_id ON api_requests(user_id);

-- The backend uses the service role key; no client should read this table directly.
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN api_requests.key_id IS 'The key used; NULL when the key was invalid, expired or revoked.';
COMMENT ON COLUMN api_requests.endpoint IS 'The route (e.g. /v1/checks/summary), not the full URL.';
COMMENT ON COLUMN api_requests.error_code IS 'error.code from the JSON error body, for 4xx/5xx responses.';
COMMENT ON COLUMN api_requests.request_id IS 'X-Request-ID, also on every server log line for the request.';


-- Headline numbers for API requests in [p_start, p_end). Rates are left to the caller.
CREATE OR REPLACE FUNCTION analytics_api_period_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'requests', count(*),
        'succeeded', count(*) FILTER (WHERE status_code < 400),
        'client_errors', count(*) FILTER (WHERE status_code >= 400 AND status_code < 500),
        'server_errors', count(*) FILTER (WHERE status_code >= 500),
        'invalid_key', count(*) FILTER (WHERE key_id IS NULL),
        'active_keys', count(DISTINCT key_id),
        'active_users', count(DISTINCT user_id),
        'p50_duration_ms', percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status_code < 400),
        'p95_duration_ms', percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status_code < 400)
    )
    FROM api_requests
    WHERE created_at >= p_start AND created_at < p_end;
$$;


-- Everything the API usage page shows for [p_start, p_end), with the same-length period before it for comparison.
-- Buckets are calendar days/weeks in p_tz, every bucket present (zeros when nothing was called).
CREATE OR REPLACE FUNCTION analytics_api_usage(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_bucket TEXT DEFAULT 'day',
    p_tz TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_prev_start TIMESTAMPTZ := p_start - (p_end - p_start);
    v_result JSONB;
BEGIN
    IF p_bucket NOT IN ('day', 'week') THEN
        RAISE EXCEPTION 'p_bucket must be day or week, got %', p_bucket;
    END IF;

    WITH period_requests AS (
        SELECT * FROM api_requests WHERE created_at >= p_start AND created_at < p_end
    ),
    buckets AS (
        SELECT b::date AS bucket
        FROM generate_series(
            date_trunc(p_bucket, p_start AT TIME ZONE p_tz),
            date_trunc(p_bucket, (p_end AT TIME ZONE p_tz) - INTERVAL '1 microsecond'),
            ('1 ' || p_bucket)::INTERVAL
        ) AS b
    ),
    bucket_stats AS (
        SELECT
            date_trunc(p_bucket, created_at AT TIME ZONE p_tz)::date AS bucket,
            count(*) FILTER (WHERE status_code < 400) AS succeeded,
            count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS client_errors,
            count(*) FILTER (WHERE status_code >= 500) AS server_errors
        FROM period_requests
        GROUP BY 1
    ),
    endpoints AS (
        SELECT endpoint,
               count(*) AS requests,
               count(*) FILTER (WHERE status_code >= 400) AS errors,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status_code < 400) AS p95_duration_ms,
               max(created_at) AS last_request_at
        FROM period_requests
        GROUP BY 1
    ),
    keys AS (
        SELECT k.id AS key_id, k.name, k.key_prefix, k.expires_at, k.revoked_at,
               u.id AS user_id, u.display_name, u.email, u.avatar_url,
               count(*) AS requests,
               count(*) FILTER (WHERE r.status_code >= 400) AS errors,
               max(r.created_at) AS last_request_at
        FROM period_requests r
        JOIN api_keys k ON k.id = r.key_id
        LEFT JOIN users u ON u.id = k.user_id
        GROUP BY k.id, u.id
    ),
    errors AS (
        SELECT coalesce(error_code, 'http_' || status_code) AS error_code, status_code, count(*) AS requests
        FROM period_requests
        WHERE status_code >= 400
        GROUP BY 1, 2
    ),
    recent_failures AS (
        SELECT r.id, r.created_at, r.method, r.endpoint, r.status_code, r.error_code, r.duration_ms, r.run_id,
               r.request_id, k.name AS key_name, k.key_prefix, u.display_name, u.email
        FROM period_requests r
        LEFT JOIN api_keys k ON k.id = r.key_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.status_code >= 400
        ORDER BY r.created_at DESC
        LIMIT 50
    )
    SELECT jsonb_build_object(
        'current', analytics_api_period_stats(p_start, p_end),
        'previous', analytics_api_period_stats(v_prev_start, p_start),
        'data_since', (SELECT min(created_at) FROM api_requests),
        'timeseries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'bucket', b.bucket,
                'succeeded', coalesce(s.succeeded, 0),
                'client_errors', coalesce(s.client_errors, 0),
                'server_errors', coalesce(s.server_errors, 0)
            ) ORDER BY b.bucket), '[]'::jsonb)
            FROM buckets b
            LEFT JOIN bucket_stats s ON s.bucket = b.bucket
        ),
        'endpoints', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.requests DESC, e.endpoint), '[]'::jsonb) FROM endpoints e),
        'keys', (SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.requests DESC, k.name), '[]'::jsonb) FROM keys k),
        'errors', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.requests DESC, e.error_code), '[]'::jsonb) FROM errors e),
        'recent_failures', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.created_at DESC), '[]'::jsonb) FROM recent_failures f)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;


REVOKE ALL ON FUNCTION analytics_api_period_stats(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_api_usage(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_api_period_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_api_usage(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
