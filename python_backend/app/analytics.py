"""
Analytics module for storing validation run data to Supabase.
"""
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

VALIDATION_CATEGORIES = ['par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general']
MAX_ERROR_MESSAGE_LENGTH = 1000


def get_supabase_client():
    """Initialize and return Supabase client if credentials are available."""
    try:
        from supabase import create_client, Client

        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')

        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found. Analytics will be skipped.")
            return None

        return create_client(supabase_url, supabase_key)
    except ImportError:
        logger.warning("supabase-py not installed. Install with: pip install supabase")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None


# Each issue list in the results JSON, and the severity analytics stores for its issues.
SEVERITY_OF_LIST = {'errors': 'error', 'warnings': 'warning', 'infos': 'info'}


def _issues(results_json: Dict[str, Any]):
    """(category, list name, issue) for every issue in results JSON. The list an issue is in is its severity:
    a classifier name alone doesn't say it, and names once existed as both an error and a warning."""
    for category_key in VALIDATION_CATEGORIES:
        details = results_json.get(category_key, {}).get('details', {})
        for by_list in details.values():
            for list_name in SEVERITY_OF_LIST:
                for issue in by_list.get(list_name, []):
                    yield category_key, list_name, issue


def extract_validation_counts(results_json: Dict[str, Any]) -> Dict[str, int]:
    """total_errors, total_warnings and total_infos in results JSON."""
    counts = {f'total_{list_name}': 0 for list_name in SEVERITY_OF_LIST}
    for _, list_name, _ in _issues(results_json):
        counts[f'total_{list_name}'] += 1
    return counts


def extract_individual_validations(results_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """One row per issue in results JSON, ready for the validations table."""
    return [
        {
            'validation_type': issue.get('validationClassifier', 'UNKNOWN'),
            'severity': SEVERITY_OF_LIST[list_name],
            'category': category_key,
            'identifier': issue.get('identifier', '') or '',
        }
        for category_key, list_name, issue in _issues(results_json)
    ]


def get_app_version() -> Optional[str]:
    """Deployment that handled a run: APP_VERSION if set, else the Fly deployment tag from FLY_IMAGE_REF."""
    version = os.getenv('APP_VERSION')
    if version:
        return version
    image_ref = os.getenv('FLY_IMAGE_REF')  # e.g. registry.fly.io/template-checker:deployment-01J...
    if image_ref:
        return image_ref.rsplit(':', 1)[-1]
    return None


def first_error_message(results_json: Dict[str, Any]) -> Optional[str]:
    """The first error's message in results JSON (for a rejected upload, the reason it was rejected)."""
    return next((issue['context'] for _, list_name, issue in _issues(results_json)
                 if list_name == 'errors' and issue.get('context')), None)


def log_analytics_to_supabase(
    template_name: str,
    source_type: str,
    duration_ms: int,
    file_size_bytes: int,
    results_json: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    status: str = 'completed',
    stopped_at_stage: Optional[str] = None,
    error_message: Optional[str] = None,
) -> Optional[str]:
    """
    Log analytics data to Supabase.

    Args:
        template_name: Name of the template
        source_type: Source of the request ('react-frontend', 'extension', or 'api')
        duration_ms: Duration of validation in milliseconds
        file_size_bytes: Size of uploaded file in bytes
        results_json: Full validation results JSON. None when the checker crashed before producing results.
        user_id: Optional UUID of the user who ran the validation (users.id). None for unauthenticated runs.
        status: 'completed', 'rejected' (the upload couldn't be checked) or 'failed' (the checker crashed)
        stopped_at_stage: Checker state the run stopped or crashed in, for rejected and failed runs
        error_message: Why a rejected or failed run didn't complete

    Returns:
        The new run's id if successful, None otherwise
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            return None

        # Extract validation counts
        counts = extract_validation_counts(results_json or {})

        # Prepare run data
        run_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'template_name': template_name or 'Unknown',
            'source_type': source_type,
            'duration_ms': duration_ms,
            'file_size_bytes': file_size_bytes,
            'total_errors': counts['total_errors'],
            'total_warnings': counts['total_warnings'],
            'total_infos': counts['total_infos'],
            'status': status,
            'stopped_at_stage': stopped_at_stage,
            'error_message': error_message[:MAX_ERROR_MESSAGE_LENGTH] if error_message else None,
            'app_version': get_app_version(),
        }
        if user_id is not None:
            run_data['user_id'] = user_id

        # Insert run record
        run_response = supabase.table('runs').insert(run_data).execute()

        if not run_response.data:
            logger.error("Failed to insert run record to Supabase")
            return None

        run_id = run_response.data[0].get('id')
        if not run_id:
            logger.error("No run ID returned from Supabase insert")
            return None

        # Extract and insert individual validations
        validations = extract_individual_validations(results_json or {})

        if validations:
            # Add run_id to each validation
            for validation in validations:
                validation['run_id'] = run_id

            # Insert in batches to avoid hitting size limits (Supabase allows up to 1000 rows per insert)
            batch_size = 1000
            for i in range(0, len(validations), batch_size):
                batch = validations[i:i + batch_size]
                supabase.table('validations').insert(batch).execute()

            logger.info(f"Successfully logged {len(validations)} validations for run {run_id}")
        else:
            logger.info(f"No validations to log for run {run_id}")

        logger.info(f"Successfully logged analytics for run {run_id}")
        return str(run_id)

    except Exception as e:
        logger.error(f"Error logging analytics to Supabase: {e}", exc_info=True)
        return None
