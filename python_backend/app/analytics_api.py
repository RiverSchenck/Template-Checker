"""
API functions for fetching analytics data from Supabase.
"""
import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


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
            run_date = datetime.fromisoformat(run.get('timestamp', '').replace('Z', '+00:00'))
            day_key = run_date.strftime('%Y-%m-%d')
            if day_key not in runs_by_day:
                runs_by_day[day_key] = {
                    'date': day_key,
                    'runs': 0,
                    'errors': 0,
                    'warnings': 0,
                    'infos': 0
                }
            runs_by_day[day_key]['runs'] += 1
            runs_by_day[day_key]['errors'] += run.get('total_errors', 0)
            runs_by_day[day_key]['warnings'] += run.get('total_warnings', 0)
            runs_by_day[day_key]['infos'] += run.get('total_infos', 0)

        # Sort by date
        runs_over_time = sorted(runs_by_day.values(), key=lambda x: x['date'])

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
