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


def determine_severity(validation_type: str) -> str:
    """Determine severity from validation type."""
    # Warning types
    warning_types = [
        'HYPHENATION', 'OVERRIDE', 'UNUSED_IMAGE', 'IMAGE_TRANSFORMATION',
        'IMAGE_TRANSFORMATION_IMAGE', 'IMAGE_TRANSFORMATION_CONTAINER',
        'PAGE_ITEM_TRANSFORMATION',
        'DOCUMENT_BLEED', 'COMPOSER'
    ]

    # Info types
    info_types = ['EMPTY_TEXT_FRAME', 'LARGE_IMAGE']

    if validation_type in warning_types or validation_type.startswith('WARNING'):
        return 'warning'
    elif validation_type in info_types or validation_type.startswith('INFO'):
        return 'info'
    else:
        return 'error'


def extract_validation_counts(results_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract validation counts from results JSON.

    Returns:
        Dictionary with:
        - total_errors, total_warnings, total_infos
    """
    total_errors = 0
    total_warnings = 0
    total_infos = 0

    for category_key in VALIDATION_CATEGORIES:
        category_data = results_json.get(category_key, {})
        details = category_data.get('details', {})

        for identifier, type_dict in details.items():
            errors = type_dict.get('errors', [])
            warnings = type_dict.get('warnings', [])
            infos = type_dict.get('infos', [])

            total_errors += len(errors)
            total_warnings += len(warnings)
            total_infos += len(infos)

    return {
        'total_errors': total_errors,
        'total_warnings': total_warnings,
        'total_infos': total_infos
    }


def extract_individual_validations(results_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract all individual validations from results JSON.

    Returns:
        List of validation dictionaries ready for database insertion
    """
    validations = []
    for category_key in VALIDATION_CATEGORIES:
        category_data = results_json.get(category_key, {})
        details = category_data.get('details', {})

        for identifier, type_dict in details.items():
            # Process errors
            for error in type_dict.get('errors', []):
                validation_type = error.get('validationClassifier', 'UNKNOWN')

                validations.append({
                    'validation_type': validation_type,
                    'severity': determine_severity(validation_type),
                    'category': category_key,
                    'identifier': error.get('identifier', '') or ''
                })

            # Process warnings
            for warning in type_dict.get('warnings', []):
                validation_type = warning.get('validationClassifier', 'UNKNOWN')

                validations.append({
                    'validation_type': validation_type,
                    'severity': determine_severity(validation_type),
                    'category': category_key,
                    'identifier': warning.get('identifier', '') or ''
                })

            # Process infos
            for info in type_dict.get('infos', []):
                validation_type = info.get('validationClassifier', 'UNKNOWN')

                validations.append({
                    'validation_type': validation_type,
                    'severity': determine_severity(validation_type),
                    'category': category_key,
                    'identifier': info.get('identifier', '') or ''
                })

    return validations


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
    for category_key in VALIDATION_CATEGORIES:
        details = results_json.get(category_key, {}).get('details', {})
        for type_dict in details.values():
            for error in type_dict.get('errors', []):
                if error.get('context'):
                    return error['context']
    return None


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
) -> bool:
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
        True if successful, False otherwise
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            return False

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
            return False

        run_id = run_response.data[0].get('id')
        if not run_id:
            logger.error("No run ID returned from Supabase insert")
            return False

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
        return True

    except Exception as e:
        logger.error(f"Error logging analytics to Supabase: {e}", exc_info=True)
        return False
