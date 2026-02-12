"""
API functions for fetching analytics data from Supabase.
"""
import os
import logging
import re
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

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


def get_analytics_summary(days: int = 30) -> Dict[str, Any]:
    """
    Get analytics summary for the last N days.

    Returns:
        Dictionary with summary statistics
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            return {'error': 'Supabase not configured'}

        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get runs summary
        runs_response = supabase.table('runs')\
            .select('*')\
            .gte('timestamp', start_date.isoformat())\
            .order('timestamp', desc=True)\
            .execute()

        runs = runs_response.data if runs_response.data else []

        # Calculate summary stats
        total_runs = len(runs)
        total_errors = sum(r.get('total_errors', 0) for r in runs)
        total_warnings = sum(r.get('total_warnings', 0) for r in runs)
        total_infos = sum(r.get('total_infos', 0) for r in runs)

        avg_duration = sum(r.get('duration_ms', 0) for r in runs) / total_runs if total_runs > 0 else 0
        avg_file_size = sum(r.get('file_size_bytes', 0) for r in runs) / total_runs if total_runs > 0 else 0

        # Get source type breakdown
        source_types = {}
        for run in runs:
            source = run.get('source_type', 'unknown')
            if source not in source_types:
                source_types[source] = {'count': 0, 'total_errors': 0, 'total_warnings': 0, 'total_infos': 0}
            source_types[source]['count'] += 1
            source_types[source]['total_errors'] += run.get('total_errors', 0)
            source_types[source]['total_warnings'] += run.get('total_warnings', 0)
            source_types[source]['total_infos'] += run.get('total_infos', 0)

        # Get most common validation types
        validations_response = supabase.table('validations')\
            .select('validation_type, severity, category')\
            .gte('created_at', start_date.isoformat())\
            .execute()

        validations = validations_response.data if validations_response.data else []

        # Group by validation_type and severity using a tuple key
        # Helper function to determine severity (same logic as in analytics.py)
        def determine_severity(validation_type: str) -> str:
            """Determine severity from validation type."""
            warning_types = [
                'HYPHENATION', 'OVERRIDE', 'UNUSED_IMAGE', 'IMAGE_TRANSFORMATION',
                'IMAGE_TRANSFORMATION_IMAGE', 'IMAGE_TRANSFORMATION_CONTAINER',
                'DOCUMENT_BLEED', 'COMPOSER'
            ]
            info_types = ['EMPTY_TEXT_FRAME', 'LARGE_IMAGE']

            if validation_type in warning_types or validation_type.startswith('WARNING'):
                return 'warning'
            elif validation_type in info_types or validation_type.startswith('INFO'):
                return 'info'
            else:
                return 'error'

        validation_counts = {}
        for v in validations:
            v_type = v.get('validation_type', 'UNKNOWN')
            severity = v.get('severity', 'error')
            # Ensure severity is one of the valid values
            if severity not in ['error', 'warning', 'info']:
                # If severity is invalid, re-determine it from validation_type
                severity = determine_severity(v_type)

            # Use tuple as key to avoid issues with underscores in validation_type
            key = (v_type, severity)
            validation_counts[key] = validation_counts.get(key, 0) + 1

        # Sort all validation types by count (descending)
        all_validations = sorted(
            validation_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # Prepare time series data for runs over time (group by day)
        runs_by_day = {}
        for run in runs:
            run_date = parse_timestamp(run.get('timestamp', ''))
            day_key = run_date.strftime('%Y-%m-%d')
            if day_key not in runs_by_day:
                runs_by_day[day_key] = {
                    'date': day_key,
                    'runs': 0,
                    'errors': 0,
                    'warnings': 0,
                    'infos': 0,
                    'react_frontend': 0,
                    'extension': 0,
                    'api': 0,
                    'react_frontend_errors': 0,
                    'react_frontend_warnings': 0,
                    'react_frontend_infos': 0,
                    'extension_errors': 0,
                    'extension_warnings': 0,
                    'extension_infos': 0,
                    'api_errors': 0,
                    'api_warnings': 0,
                    'api_infos': 0,
                    'errors_0': 0,
                    'errors_1_5': 0,
                    'errors_6_10': 0,
                    'errors_11_15': 0,
                    'errors_16_plus': 0,
                    'warnings_0': 0,
                    'warnings_1_5': 0,
                    'warnings_6_10': 0,
                    'warnings_11_15': 0,
                    'warnings_16_plus': 0,
                    'infos_0': 0,
                    'infos_1_5': 0,
                    'infos_6_10': 0,
                    'infos_11_15': 0,
                    'infos_16_plus': 0,
                }
            runs_by_day[day_key]['runs'] += 1
            runs_by_day[day_key]['errors'] += run.get('total_errors', 0)
            runs_by_day[day_key]['warnings'] += run.get('total_warnings', 0)
            runs_by_day[day_key]['infos'] += run.get('total_infos', 0)
            # Per-source run counts and issues
            source = run.get('source_type', 'unknown')
            re = run.get('total_errors', 0)
            rw = run.get('total_warnings', 0)
            ri = run.get('total_infos', 0)
            if source == 'react-frontend':
                runs_by_day[day_key]['react_frontend'] += 1
                runs_by_day[day_key]['react_frontend_errors'] += re
                runs_by_day[day_key]['react_frontend_warnings'] += rw
                runs_by_day[day_key]['react_frontend_infos'] += ri
            elif source == 'extension':
                runs_by_day[day_key]['extension'] += 1
                runs_by_day[day_key]['extension_errors'] += re
                runs_by_day[day_key]['extension_warnings'] += rw
                runs_by_day[day_key]['extension_infos'] += ri
            elif source == 'api':
                runs_by_day[day_key]['api'] += 1
                runs_by_day[day_key]['api_errors'] += re
                runs_by_day[day_key]['api_warnings'] += rw
                runs_by_day[day_key]['api_infos'] += ri
            # Per-run histogram buckets (errors, warnings, infos): 0, 1-5, 6-10, 11-15, 16+
            def bucket_suffix(val):
                if val == 0:
                    return '_0'
                if 1 <= val <= 5:
                    return '_1_5'
                if 6 <= val <= 10:
                    return '_6_10'
                if 11 <= val <= 15:
                    return '_11_15'
                return '_16_plus'
            e = run.get('total_errors', 0)
            runs_by_day[day_key]['errors' + bucket_suffix(e)] += 1
            w = run.get('total_warnings', 0)
            runs_by_day[day_key]['warnings' + bucket_suffix(w)] += 1
            i = run.get('total_infos', 0)
            runs_by_day[day_key]['infos' + bucket_suffix(i)] += 1

        # Sort by date
        runs_over_time = sorted(runs_by_day.values(), key=lambda x: x['date'])
        bucket_keys = ('_0', '_1_5', '_6_10', '_11_15', '_16_plus')
        errors_per_run_by_day = [
            {'date': row['date'], **{f'errors{k}': row[f'errors{k}'] for k in bucket_keys}}
            for row in runs_over_time
        ]
        warnings_per_run_by_day = [
            {'date': row['date'], **{f'warnings{k}': row[f'warnings{k}'] for k in bucket_keys}}
            for row in runs_over_time
        ]
        infos_per_run_by_day = [
            {'date': row['date'], **{f'infos{k}': row[f'infos{k}'] for k in bucket_keys}}
            for row in runs_over_time
        ]

        return {
            'summary': {
                'total_runs': total_runs,
                'total_errors': total_errors,
                'total_warnings': total_warnings,
                'total_infos': total_infos,
                'avg_duration_ms': int(avg_duration),
                'avg_file_size_bytes': int(avg_file_size),
                'days': days
            },
            'source_types': source_types,
            'all_validations': [{'type': k[0], 'severity': k[1], 'count': v} for k, v in all_validations],
            'runs_over_time': runs_over_time,
            'errors_per_run_by_day': errors_per_run_by_day,
            'warnings_per_run_by_day': warnings_per_run_by_day,
            'infos_per_run_by_day': infos_per_run_by_day,
            'recent_runs': runs[:50]  # Last 50 runs
        }

    except Exception as e:
        logger.error(f"Error fetching analytics: {e}", exc_info=True)
        return {'error': str(e)}


def get_runs(limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """
    Get paginated list of runs.

    Args:
        limit: Number of runs to return
        offset: Offset for pagination
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            return {'error': 'Supabase not configured'}

        runs_response = supabase.table('runs')\
            .select('*')\
            .order('timestamp', desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        count_response = supabase.table('runs')\
            .select('id', count='exact')\
            .execute()

        total_count = count_response.count if hasattr(count_response, 'count') else len(runs_response.data)

        return {
            'runs': runs_response.data if runs_response.data else [],
            'total': total_count,
            'limit': limit,
            'offset': offset
        }

    except Exception as e:
        logger.error(f"Error fetching runs: {e}", exc_info=True)
        return {'error': str(e)}
