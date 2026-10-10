-- Migration: Analytics v2. Run outcomes on `runs`, and SQL functions that aggregate in the database.
-- Run in the Template Checker Supabase project (SQL Editor or migration tool), BEFORE deploying the backend
-- that writes runs.status (the insert fails on the old schema, and that run's analytics are lost).
--
-- runs.status:
--   completed  the checker ran every check (the normal case; all existing rows)
--   rejected   the upload couldn't be checked (not a ZIP, no or several .idml files, unreadable XML).
--              stopped_at_stage names the step, error_message is the message the user saw.
--   failed     the checker crashed. error_message is the exception, stopped_at_stage where it happened.
-- app_version identifies the deployment that handled the run, to line failures up with releases.
--
-- The functions replace fetching every row into Python, which silently stopped at the API row cap (1000).
-- Only the backend (service role) may call them; Supabase exposes functions over the public API, so EXECUTE
-- is revoked from everyone else below.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS stopped_at_stage TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS app_version TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'runs_status_check') THEN
        ALTER TABLE runs ADD CONSTRAINT runs_status_check CHECK (status IN ('completed', 'rejected', 'failed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_runs_status_timestamp ON runs(status, timestamp);
CREATE INDEX IF NOT EXISTS idx_validations_type_run_id ON validations(validation_type, run_id);


-- Headline numbers for runs in [p_start, p_end). Rates are left to the caller so both periods share one shape.
CREATE OR REPLACE FUNCTION analytics_period_stats(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'runs', count(*),
        'completed', count(*) FILTER (WHERE status = 'completed'),
        'rejected', count(*) FILTER (WHERE status = 'rejected'),
        'failed', count(*) FILTER (WHERE status = 'failed'),
        'clean_runs', count(*) FILTER (WHERE status = 'completed' AND total_errors = 0),
        'active_users', count(DISTINCT user_id),
        'median_errors', percentile_cont(0.5) WITHIN GROUP (ORDER BY total_errors) FILTER (WHERE status = 'completed'),
        'median_warnings', percentile_cont(0.5) WITHIN GROUP (ORDER BY total_warnings) FILTER (WHERE status = 'completed'),
        'p50_duration_ms', percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed'),
        'p95_duration_ms', percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed'),
        'median_file_size_bytes', percentile_cont(0.5) WITHIN GROUP (ORDER BY file_size_bytes)
    )
    FROM runs
    WHERE timestamp >= p_start AND timestamp < p_end;
$$;


-- Everything the analytics page shows for [p_start, p_end), compared with the same-length period before it
-- (period.previous_start; compare with data_since to know whether that period is fully covered).
-- p_bucket ('day' or 'week') sizes the time series; buckets are calendar days/weeks in p_tz and every bucket
-- in the range is present, with zeros when nothing ran.
CREATE OR REPLACE FUNCTION analytics_overview(
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

    WITH period_runs AS (
        SELECT * FROM runs WHERE timestamp >= p_start AND timestamp < p_end
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
            date_trunc(p_bucket, timestamp AT TIME ZONE p_tz)::date AS bucket,
            count(*) AS runs,
            count(*) FILTER (WHERE source_type = 'react-frontend') AS web,
            count(*) FILTER (WHERE source_type = 'extension') AS extension,
            count(*) FILTER (WHERE source_type = 'api') AS api,
            count(*) FILTER (WHERE status = 'completed') AS completed,
            count(*) FILTER (WHERE status = 'rejected') AS rejected,
            count(*) FILTER (WHERE status = 'failed') AS failed,
            count(*) FILTER (WHERE status = 'completed' AND total_errors = 0) AS clean_runs,
            count(DISTINCT user_id) AS active_users,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status = 'completed') AS p95_duration_ms
        FROM period_runs
        GROUP BY 1
    ),
    -- Issues only count on completed runs: a rejected upload never reached the checks.
    issue_counts AS (
        SELECT v.validation_type, v.severity, v.category,
               count(*) AS occurrences, count(DISTINCT v.run_id) AS runs_affected
        FROM validations v
        JOIN runs r ON r.id = v.run_id
        WHERE r.timestamp >= p_start AND r.timestamp < p_end AND r.status = 'completed'
        GROUP BY 1, 2, 3
    ),
    prev_issue_counts AS (
        SELECT v.validation_type, count(DISTINCT v.run_id) AS runs_affected
        FROM validations v
        JOIN runs r ON r.id = v.run_id
        WHERE r.timestamp >= v_prev_start AND r.timestamp < p_start AND r.status = 'completed'
        GROUP BY 1
    ),
    -- When each issue type in this period was first ever seen, to flag ones that are new (e.g. a new check).
    first_seen AS (
        SELECT v.validation_type, min(r.timestamp) AS first_seen_at
        FROM validations v
        JOIN runs r ON r.id = v.run_id
        WHERE v.validation_type IN (SELECT validation_type FROM issue_counts) AND r.status = 'completed'
        GROUP BY 1
    ),
    category_counts AS (
        SELECT v.category, count(*) AS occurrences, count(DISTINCT v.run_id) AS runs_affected
        FROM validations v
        JOIN runs r ON r.id = v.run_id
        WHERE r.timestamp >= p_start AND r.timestamp < p_end AND r.status = 'completed'
        GROUP BY 1
    ),
    user_counts AS (
        SELECT r.user_id, u.display_name, u.email, u.avatar_url,
               count(*) AS runs,
               count(*) FILTER (WHERE r.status <> 'completed') AS problem_runs,
               max(r.timestamp) AS last_run_at
        FROM period_runs r
        LEFT JOIN users u ON u.id = r.user_id
        GROUP BY 1, 2, 3, 4
    ),
    problem_runs AS (
        SELECT r.id, r.timestamp, r.template_name, r.source_type, r.status, r.stopped_at_stage,
               r.error_message, r.app_version, r.duration_ms, r.file_size_bytes,
               r.user_id, u.display_name, u.email
        FROM period_runs r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.status <> 'completed'
        ORDER BY r.timestamp DESC
        LIMIT 20
    )
    SELECT jsonb_build_object(
        'period', jsonb_build_object(
            'start', p_start, 'end', p_end, 'previous_start', v_prev_start, 'bucket', p_bucket, 'tz', p_tz
        ),
        -- First run ever recorded: comparisons are only fair when the previous period starts after this.
        'data_since', (SELECT min(timestamp) FROM runs),
        'current', analytics_period_stats(p_start, p_end),
        'previous', analytics_period_stats(v_prev_start, p_start),
        'timeseries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'date', b.bucket,
                'runs', coalesce(s.runs, 0),
                'web', coalesce(s.web, 0),
                'extension', coalesce(s.extension, 0),
                'api', coalesce(s.api, 0),
                'completed', coalesce(s.completed, 0),
                'rejected', coalesce(s.rejected, 0),
                'failed', coalesce(s.failed, 0),
                'clean_runs', coalesce(s.clean_runs, 0),
                'active_users', coalesce(s.active_users, 0),
                'p95_duration_ms', s.p95_duration_ms
            ) ORDER BY b.bucket), '[]'::jsonb)
            FROM buckets b
            LEFT JOIN bucket_stats s ON s.bucket = b.bucket
        ),
        'issues', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'validation_type', i.validation_type,
                'severity', i.severity,
                'category', i.category,
                'occurrences', i.occurrences,
                'runs_affected', i.runs_affected,
                'prev_runs_affected', coalesce(p.runs_affected, 0),
                'first_seen_at', f.first_seen_at
            ) ORDER BY i.runs_affected DESC, i.occurrences DESC), '[]'::jsonb)
            FROM issue_counts i
            LEFT JOIN prev_issue_counts p ON p.validation_type = i.validation_type
            LEFT JOIN first_seen f ON f.validation_type = i.validation_type
        ),
        'categories', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'category', c.category,
                'occurrences', c.occurrences,
                'runs_affected', c.runs_affected
            ) ORDER BY c.runs_affected DESC), '[]'::jsonb)
            FROM category_counts c
        ),
        'users', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'user_id', uc.user_id,
                'display_name', uc.display_name,
                'email', uc.email,
                'avatar_url', uc.avatar_url,
                'runs', uc.runs,
                'problem_runs', uc.problem_runs,
                'last_run_at', uc.last_run_at
            ) ORDER BY uc.runs DESC), '[]'::jsonb)
            FROM user_counts uc
        ),
        'problem_runs', (
            SELECT coalesce(jsonb_agg(to_jsonb(pr) ORDER BY pr.timestamp DESC), '[]'::jsonb)
            FROM problem_runs pr
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;


-- One page of runs in [p_start, p_end), newest first. Every filter is optional (NULL = any).
-- p_search matches template names (case-insensitive substring); p_validation_type keeps runs that had that issue.
CREATE OR REPLACE FUNCTION analytics_runs(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_status TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_validation_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 25,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH matched AS (
        SELECT r.*
        FROM runs r
        WHERE r.timestamp >= p_start AND r.timestamp < p_end
          AND (p_status IS NULL OR r.status = p_status)
          AND (p_source IS NULL OR r.source_type = p_source)
          AND (p_user_id IS NULL OR r.user_id = p_user_id)
          AND (p_search IS NULL OR r.template_name ILIKE '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%')
          AND (p_validation_type IS NULL OR EXISTS (
              SELECT 1 FROM validations v WHERE v.run_id = r.id AND v.validation_type = p_validation_type
          ))
    ),
    page AS (
        SELECT m.id, m.timestamp, m.template_name, m.source_type, m.status, m.stopped_at_stage,
               m.error_message, m.app_version, m.duration_ms, m.file_size_bytes,
               m.total_errors, m.total_warnings, m.total_infos,
               m.user_id, u.display_name, u.email
        FROM matched m
        LEFT JOIN users u ON u.id = m.user_id
        ORDER BY m.timestamp DESC, m.id
        LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM matched),
        'runs', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.timestamp DESC, p.id), '[]'::jsonb) FROM page p)
    );
$$;


-- Drill-down for one issue type in [p_start, p_end): which identifiers (font names, style names, ...) hit it
-- most, and how its share of completed runs moved over time.
CREATE OR REPLACE FUNCTION analytics_issue_detail(
    p_validation_type TEXT,
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
    v_result JSONB;
BEGIN
    IF p_bucket NOT IN ('day', 'week') THEN
        RAISE EXCEPTION 'p_bucket must be day or week, got %', p_bucket;
    END IF;

    WITH hits AS (
        SELECT v.run_id, v.identifier, r.timestamp
        FROM validations v
        JOIN runs r ON r.id = v.run_id
        WHERE v.validation_type = p_validation_type
          AND r.timestamp >= p_start AND r.timestamp < p_end AND r.status = 'completed'
    ),
    buckets AS (
        SELECT b::date AS bucket
        FROM generate_series(
            date_trunc(p_bucket, p_start AT TIME ZONE p_tz),
            date_trunc(p_bucket, (p_end AT TIME ZONE p_tz) - INTERVAL '1 microsecond'),
            ('1 ' || p_bucket)::INTERVAL
        ) AS b
    ),
    completed_per_bucket AS (
        SELECT date_trunc(p_bucket, timestamp AT TIME ZONE p_tz)::date AS bucket, count(*) AS completed
        FROM runs
        WHERE timestamp >= p_start AND timestamp < p_end AND status = 'completed'
        GROUP BY 1
    ),
    affected_per_bucket AS (
        SELECT date_trunc(p_bucket, timestamp AT TIME ZONE p_tz)::date AS bucket, count(DISTINCT run_id) AS runs_affected
        FROM hits
        GROUP BY 1
    ),
    identifiers AS (
        SELECT identifier, count(*) AS occurrences, count(DISTINCT run_id) AS runs_affected
        FROM hits
        WHERE identifier IS NOT NULL AND identifier NOT IN ('', 'null')
        GROUP BY 1
        ORDER BY runs_affected DESC, occurrences DESC, identifier
        LIMIT 25
    )
    SELECT jsonb_build_object(
        'validation_type', p_validation_type,
        'occurrences', (SELECT count(*) FROM hits),
        'runs_affected', (SELECT count(DISTINCT run_id) FROM hits),
        'completed_runs', (SELECT count(*) FROM runs WHERE timestamp >= p_start AND timestamp < p_end AND status = 'completed'),
        'timeseries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'date', b.bucket,
                'completed', coalesce(c.completed, 0),
                'runs_affected', coalesce(a.runs_affected, 0)
            ) ORDER BY b.bucket), '[]'::jsonb)
            FROM buckets b
            LEFT JOIN completed_per_bucket c ON c.bucket = b.bucket
            LEFT JOIN affected_per_bucket a ON a.bucket = b.bucket
        ),
        'identifiers', (
            SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.runs_affected DESC, i.occurrences DESC, i.identifier), '[]'::jsonb)
            FROM identifiers i
        )
    )
    INTO v_result;

    RETURN v_result;
END;
$$;


REVOKE ALL ON FUNCTION analytics_period_stats(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_runs(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_issue_detail(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_period_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_overview(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_runs(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_issue_detail(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
