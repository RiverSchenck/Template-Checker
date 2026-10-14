/** Shapes returned by the analytics endpoints (python_backend/app/analytics_api.py, migrations/007). */

export type RunStatus = 'completed' | 'rejected' | 'failed';
export type SourceType = 'react-frontend' | 'extension' | 'api';
export type Severity = 'error' | 'warning' | 'info';
export type Bucket = 'day' | 'week';

/** Headline numbers for one period. Medians/percentiles are null when there were no completed runs. */
export interface PeriodStats {
  runs: number;
  completed: number;
  rejected: number;
  failed: number;
  clean_runs: number;
  active_users: number;
  median_errors: number | null;
  median_warnings: number | null;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
  median_file_size_bytes: number | null;
}

export interface TimeseriesPoint {
  /** First day of the bucket, YYYY-MM-DD in the requested timezone. */
  date: string;
  runs: number;
  web: number;
  extension: number;
  api: number;
  completed: number;
  rejected: number;
  failed: number;
  clean_runs: number;
  active_users: number;
  p95_duration_ms: number | null;
}

export interface IssueSummary {
  validation_type: string;
  severity: Severity;
  category: string;
  occurrences: number;
  runs_affected: number;
  prev_runs_affected: number;
  first_seen_at: string;
  label: string;
  message: string | null;
  help_article: string | null;
}

export interface CategorySummary {
  category: string;
  occurrences: number;
  runs_affected: number;
}

export interface UserSummary {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  runs: number;
  problem_runs: number;
  last_run_at: string;
}

export interface RunRow {
  id: string;
  timestamp: string;
  template_name: string;
  source_type: SourceType;
  status: RunStatus;
  stopped_at_stage: string | null;
  error_message: string | null;
  app_version: string | null;
  duration_ms: number;
  file_size_bytes: number;
  total_errors?: number;
  total_warnings?: number;
  total_infos?: number;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
}

export interface Overview {
  period: { start: string; end: string; previous_start: string; bucket: Bucket; tz: string };
  /** When the first run was recorded (null if never). */
  data_since: string | null;
  current: PeriodStats;
  previous: PeriodStats;
  timeseries: TimeseriesPoint[];
  issues: IssueSummary[];
  categories: CategorySummary[];
  users: UserSummary[];
  problem_runs: RunRow[];
}

export interface IssueDetail {
  validation_type: string;
  label: string;
  message: string | null;
  help_article: string | null;
  occurrences: number;
  runs_affected: number;
  completed_runs: number;
  timeseries: { date: string; completed: number; runs_affected: number }[];
  identifiers: { identifier: string; occurrences: number; runs_affected: number }[];
}

export interface RunsPage {
  total: number;
  runs: RunRow[];
}

/** What the page reports on: the last N days, or a custom range of calendar days (YYYY-MM-DD, inclusive). */
export type PeriodSelection = { kind: 'preset'; days: number } | { kind: 'custom'; start: string; end: string };

export interface RunFilters {
  status?: RunStatus;
  source?: SourceType;
  userId?: string;
  validationType?: string;
  search?: string;
}

/** Headline numbers for API-key requests in one period (migrations/014). Durations cover successful requests. */
export interface ApiPeriodStats {
  requests: number;
  succeeded: number;
  client_errors: number;
  server_errors: number;
  /** Requests with a well-formed key that wasn't valid (unknown, expired or revoked). */
  invalid_key: number;
  active_keys: number;
  active_users: number;
  p50_duration_ms: number | null;
  p95_duration_ms: number | null;
}

export interface ApiTimeseriesPoint {
  bucket: string;
  succeeded: number;
  client_errors: number;
  server_errors: number;
}

export interface ApiEndpointSummary {
  endpoint: string;
  requests: number;
  errors: number;
  p95_duration_ms: number | null;
  last_request_at: string;
}

export interface ApiKeySummary {
  key_id: string;
  name: string;
  key_prefix: string;
  expires_at: string | null;
  revoked_at: string | null;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  requests: number;
  errors: number;
  last_request_at: string;
}

export interface ApiErrorSummary {
  /** error.code from the response, or http_<status> when there was none. */
  error_code: string;
  status_code: number;
  requests: number;
}

export interface ApiFailure {
  id: string;
  created_at: string;
  method: string;
  endpoint: string;
  status_code: number;
  error_code: string | null;
  duration_ms: number | null;
  run_id: string | null;
  request_id: string | null;
  /** Null when the key wasn't valid. */
  key_name: string | null;
  key_prefix: string | null;
  display_name: string | null;
  email: string | null;
}

/** GET /analytics/api (admin only). */
export interface ApiUsage {
  current: ApiPeriodStats;
  previous: ApiPeriodStats;
  /** When API requests were first recorded; null before any. */
  data_since: string | null;
  timeseries: ApiTimeseriesPoint[];
  endpoints: ApiEndpointSummary[];
  keys: ApiKeySummary[];
  errors: ApiErrorSummary[];
  recent_failures: ApiFailure[];
}
