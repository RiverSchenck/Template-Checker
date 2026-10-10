"""
API functions for fetching analytics data from Supabase.

Aggregation happens in Postgres (migrations/007_analytics_v2.sql); this module validates parameters and
calls those functions.
"""
import csv
import io
import os
import logging
import re
from typing import Dict, Any, Optional
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo

logger = logging.getLogger(__name__)


def parse_timestamp(timestamp_str: str) -> datetime:
    """
    Parse ISO timestamp string with variable-length microseconds.
    Handles formats like:
    - '2026-01-18T13:41:18.6297+00:00' (4 digits)
    - '2026-01-18T13:41:18.629700+00:00' (6 digits)
    - '2026-01-18T13:41:18Z' (no microseconds)
    """
    if not timestamp_str:
        raise ValueError("Empty timestamp string")

    # Normalize Z timezone to +00:00
    timestamp_str = timestamp_str.replace('Z', '+00:00')

    # Check if there are microseconds (pattern: .[digits] before timezone or end)
    # Match microseconds and timezone separately
    match = re.match(r'^(.+?)\.(\d+)([\+\-]\d{2}:\d{2}|$)', timestamp_str)
    if match:
        base_part = match.group(1)  # Everything before the microseconds
        microseconds_str = match.group(2)  # The microseconds digits
        tz_part = match.group(3) or ''  # Timezone or empty

        # Pad or truncate microseconds to exactly 6 digits
        if len(microseconds_str) < 6:
            microseconds_str = microseconds_str.ljust(6, '0')
        elif len(microseconds_str) > 6:
            microseconds_str = microseconds_str[:6]

        # Reconstruct the timestamp with normalized microseconds
        timestamp_str = f"{base_part}.{microseconds_str}{tz_part}"

    try:
        return datetime.fromisoformat(timestamp_str)
    except ValueError as e:
        logger.error(f"Failed to parse timestamp '{timestamp_str}': {e}")
        raise


def get_supabase_client():
    """Initialize and return Supabase client if credentials are available."""
    try:
        from supabase import create_client

        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')

        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found.")
            return None

        return create_client(supabase_url, supabase_key)
    except ImportError:
        logger.warning("supabase-py not installed.")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


MAX_DAYS = 366
# Up to this many days the time series is daily; longer ranges are weekly so charts stay readable.
MAX_DAILY_BUCKET_DAYS = 90
MAX_RUNS_PAGE_SIZE = 100
# A CSV export is one query; past this many rows, narrow the filters.
MAX_EXPORT_ROWS = 10000
RUN_STATUSES = ('completed', 'rejected', 'failed')
SOURCE_TYPES = ('react-frontend', 'extension', 'api')
MAX_SEARCH_LENGTH = 200
_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
_VALIDATION_TYPE_RE = re.compile(r'^[A-Za-z0-9_]{1,100}$')
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


class AnalyticsQueryError(ValueError):
    """A request parameter is invalid; the message is safe to show the caller."""


def _parse_date(value: str, name: str) -> date:
    if not _DATE_RE.match(value or ''):
        raise AnalyticsQueryError(f'{name} must be a date like 2026-10-01')
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise AnalyticsQueryError(f'{name} must be a real date')


def analytics_period(
    days: Any = 30,
    tz: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """The window to report on, as seen from timezone tz.

    Either "the last N days" (local midnight N-1 days ago until now) or a custom range of calendar days
    start..end inclusive (an end of today stops at now). Day buckets line up with the viewer's calendar days.
    The previous period used for comparisons (computed in SQL) is the same length, immediately before.
    """
    tz = tz or 'UTC'
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise AnalyticsQueryError('tz must be an IANA timezone name, e.g. Europe/Zurich')
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(zone).date()

    if start or end:
        if not (start and end):
            raise AnalyticsQueryError('A custom range needs both start and end')
        first_day, last_day = _parse_date(start, 'start'), _parse_date(end, 'end')
        if first_day > last_day:
            raise AnalyticsQueryError('start must be on or before end')
        if first_day > today:
            raise AnalyticsQueryError('start cannot be in the future')
        last_day = min(last_day, today)
        days = (last_day - first_day).days + 1
        if days > MAX_DAYS:
            raise AnalyticsQueryError(f'A range can be at most {MAX_DAYS} days')
        period_end = min(now, datetime.combine(last_day + timedelta(days=1), time.min, tzinfo=zone))
    else:
        try:
            days = int(days)
        except (TypeError, ValueError):
            raise AnalyticsQueryError('days must be a whole number')
        if not 1 <= days <= MAX_DAYS:
            raise AnalyticsQueryError(f'days must be between 1 and {MAX_DAYS}')
        first_day = today - timedelta(days=days - 1)
        period_end = now

    return {
        'start': datetime.combine(first_day, time.min, tzinfo=zone).isoformat(),
        'end': period_end.isoformat(),
        'tz': tz,
        'bucket': 'day' if days <= MAX_DAILY_BUCKET_DAYS else 'week',
    }


def describe_issue(validation_type: str, severity: Optional[str] = None) -> Dict[str, Optional[str]]:
    """Display label, message and help article for a validation type, from the checker's own classifiers.

    A few types exist as both an error and a warning with different messages; severity picks the right one.
    """
    enums = (ValidationError, ValidationWarning, ValidationInfo)
    preferred = {'error': ValidationError, 'warning': ValidationWarning, 'info': ValidationInfo}.get(severity)
    if preferred:
        enums = (preferred,) + tuple(e for e in enums if e is not preferred)
    for enum in enums:
        classifier = enum.__members__.get(validation_type)
        if classifier is not None:
            return {
                'label': classifier.label or validation_type.replace('_', ' ').title(),
                'message': classifier.message,
                'help_article': classifier.help_article,
            }
    return {'label': validation_type.replace('_', ' ').title(), 'message': None, 'help_article': None}


def _rpc(name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    supabase = get_supabase_client()
    if not supabase:
        return {'error': 'Supabase not configured'}
    return supabase.rpc(name, params).execute().data


def get_overview(period: Dict[str, Any]) -> Dict[str, Any]:
    """Headline numbers (with the previous period), time series, issues, categories, users and problem runs."""
    overview = _rpc('analytics_overview', {
        'p_start': period['start'],
        'p_end': period['end'],
        'p_bucket': period['bucket'],
        'p_tz': period['tz'],
    })
    for issue in overview.get('issues') or []:
        issue.update(describe_issue(issue['validation_type'], issue.get('severity')))
    return overview


def get_issue_detail(validation_type: str, period: Dict[str, Any]) -> Dict[str, Any]:
    """One issue type: how often it hit over time and which identifiers (fonts, styles, ...) it hit most."""
    if not _VALIDATION_TYPE_RE.match(validation_type or ''):
        raise AnalyticsQueryError('Unknown validation type')
    detail = _rpc('analytics_issue_detail', {
        'p_validation_type': validation_type,
        'p_start': period['start'],
        'p_end': period['end'],
        'p_bucket': period['bucket'],
        'p_tz': period['tz'],
    })
    if 'error' not in detail:
        detail.update(describe_issue(validation_type))
    return detail


def run_filters(
    status: Optional[str] = None,
    source: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    validation_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Validated filters for analytics_runs, blanks turned into NULL (= any)."""
    if status and status not in RUN_STATUSES:
        raise AnalyticsQueryError(f"status must be one of: {', '.join(RUN_STATUSES)}")
    if source and source not in SOURCE_TYPES:
        raise AnalyticsQueryError(f"source must be one of: {', '.join(SOURCE_TYPES)}")
    if user_id and not _UUID_RE.match(user_id):
        raise AnalyticsQueryError('user_id must be a UUID')
    if validation_type and not _VALIDATION_TYPE_RE.match(validation_type):
        raise AnalyticsQueryError('Unknown validation type')
    search = (search or '').strip()
    if len(search) > MAX_SEARCH_LENGTH:
        raise AnalyticsQueryError(f'Search must be at most {MAX_SEARCH_LENGTH} characters')
    return {
        'p_status': status or None,
        'p_source': source or None,
        'p_user_id': user_id or None,
        'p_search': search or None,
        'p_validation_type': validation_type or None,
    }


def get_runs(period: Dict[str, Any], filters: Dict[str, Any], limit: Any = 25, offset: Any = 0) -> Dict[str, Any]:
    """One page of runs in the period, newest first. Returns {'total', 'runs'}."""
    try:
        limit, offset = int(limit), int(offset)
    except (TypeError, ValueError):
        raise AnalyticsQueryError('limit and offset must be whole numbers')
    if not 1 <= limit <= MAX_RUNS_PAGE_SIZE or offset < 0:
        raise AnalyticsQueryError(f'limit must be between 1 and {MAX_RUNS_PAGE_SIZE}, and offset at least 0')

    return _rpc('analytics_runs', {
        'p_start': period['start'],
        'p_end': period['end'],
        **filters,
        'p_limit': limit,
        'p_offset': offset,
    })


CSV_COLUMNS = [
    ('timestamp', 'Time (UTC)'),
    ('template_name', 'Template'),
    ('status', 'Result'),
    ('source_type', 'Source'),
    ('display_name', 'Agent'),
    ('email', 'Agent email'),
    ('total_errors', 'Errors'),
    ('total_warnings', 'Warnings'),
    ('total_infos', 'Infos'),
    ('duration_ms', 'Duration (ms)'),
    ('file_size_bytes', 'File size (bytes)'),
    ('stopped_at_stage', 'Stopped at'),
    ('error_message', 'Error'),
    ('app_version', 'App version'),
    ('id', 'Run ID'),
]
# A cell starting with one of these is run as a formula by Excel/Sheets. Template names and error messages
# come from customer uploads, so neutralize them.
_FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def _csv_cell(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return '' if value is None else value


def export_runs_csv(period: Dict[str, Any], filters: Dict[str, Any]) -> Dict[str, Any]:
    """Every run matching the filters (up to MAX_EXPORT_ROWS) as CSV text. Returns {'csv', 'total', 'exported'}."""
    page = _rpc('analytics_runs', {
        'p_start': period['start'],
        'p_end': period['end'],
        **filters,
        'p_limit': MAX_EXPORT_ROWS,
        'p_offset': 0,
    })
    if 'error' in page:
        return page
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow([label for _, label in CSV_COLUMNS])
    for run in page['runs']:
        writer.writerow([_csv_cell(run.get(key)) for key, _ in CSV_COLUMNS])
    return {'csv': out.getvalue(), 'total': page['total'], 'exported': len(page['runs'])}
