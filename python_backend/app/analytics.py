"""
Analytics module for storing validation run data to Supabase.
"""
import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


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

    categories = ['par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general']

    for category_key in categories:
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
    categories = ['par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general']

    for category_key in categories:
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


def log_analytics_to_supabase(
    template_name: str,
    source_type: str,
    duration_ms: int,
    file_size_bytes: int,
    results_json: Dict[str, Any]
) -> bool:
    """
    Log analytics data to Supabase.

    Args:
        template_name: Name of the template
        source_type: Source of the request ('react-frontend', 'extension', or 'api')
        duration_ms: Duration of validation in milliseconds
        file_size_bytes: Size of uploaded file in bytes
        results_json: Full validation results JSON

    Returns:
        True if successful, False otherwise
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            return False

        # Extract validation counts
        counts = extract_validation_counts(results_json)

        # Prepare run data
        run_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'template_name': template_name or 'Unknown',
            'source_type': source_type,
            'duration_ms': duration_ms,
            'file_size_bytes': file_size_bytes,
            'total_errors': counts['total_errors'],
            'total_warnings': counts['total_warnings'],
            'total_infos': counts['total_infos'],
        }

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
        validations = extract_individual_validations(results_json)

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
