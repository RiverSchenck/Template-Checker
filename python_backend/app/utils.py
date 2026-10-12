import os
import shutil
import time
import uuid
from dataclasses import dataclass
from typing import Optional
from flask import request, current_app, jsonify, g
from werkzeug.utils import secure_filename
from src.classes.States import States
from .analytics import log_analytics_to_supabase, first_error_message
from .customer_summary import CustomerSummary, build_customer_summary, check_guides_payload, summary_payload


def upload_file():
    """Handle file upload and return the file path or an error."""
    try:
        if 'file' not in request.files:
            return {'status': 'error', 'error': {'message': 'No file part'}}
        file = request.files['file']
        if file.filename == '':
            return {'status': 'error', 'error': {'message': 'No selected file'}}

        filename = secure_filename(file.filename) or 'upload.zip'
        # Each upload gets its own folder so concurrent checks never overwrite or delete each other's files
        upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], uuid.uuid4().hex)
        os.makedirs(upload_dir)
        g.upload_dir = upload_dir
        save_path = os.path.join(upload_dir, filename)
        file.save(save_path)

        return {'status': 'success', 'path': save_path}
    except Exception as e:
        current_app.logger.exception('File upload failed')
        return {'status': 'error', 'error': {'message': 'An error occurred during processing.'}}


def _log_run(**kwargs) -> Optional[str]:
    """Log a run to analytics without ever failing the check because of it. Returns the run id when logged."""
    try:
        return log_analytics_to_supabase(**kwargs)
    except Exception:
        current_app.logger.exception('Failed to log analytics to Supabase')
        return None


class CheckFailed(Exception):
    """The checker crashed. The failure is already logged (server log and analytics); callers return a 500."""


@dataclass(frozen=True)
class CheckOutcome:
    results: dict
    """The checker's results JSON (what /run returns under content.results)."""
    completed: bool
    """True when every check ran; False when the upload was rejected (results explain why)."""
    stopped_at_stage: Optional[str]
    run_id: Optional[str]
    """The analytics run id, or None if logging is off or failed."""
    summary: Optional[CustomerSummary]
    """The customer summary, or None if it couldn't be written (logged)."""


def run_check(checker, file_path: str, source_type: str = 'api', user_id: Optional[str] = None) -> CheckOutcome:
    """Run the checker on the uploaded file. Raises CheckFailed if it crashes.

    Every attempt is logged to analytics: 'completed' when all checks ran, 'rejected' when the upload couldn't be
    checked (the results explain why), and 'failed' when the checker crashed.
    """
    start_time = time.time()
    file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    run_info = {
        'template_name': os.path.basename(file_path),
        'source_type': source_type,
        'file_size_bytes': file_size_bytes,
        'user_id': user_id,
    }
    try:
        checker.set_source_file_path(file_path)
        checker.run_state_machine()

        duration_ms = int((time.time() - start_time) * 1000)

        checker_json = checker.results.get_formatted_results_json()

        # Add analytics data to results
        checker_json['analytics'] = {
            'duration_ms': duration_ms,
            'source_type': source_type,
            'file_size_bytes': file_size_bytes
        }

        # What the web app shows next to the results: the per-check copy, and the summary for the customer.
        checker_json['check_guides'] = check_guides_payload(checker_json)
        summary = _build_summary(checker_json)
        checker_json['customer_summary'] = summary_payload(summary, include_sections=True) if summary else None

        # The state machine only reaches RESULTS when every check ran; otherwise it exited early on a bad upload.
        completed = checker.last_state == States.RESULTS
        stopped_at_stage = None if completed else _state_name(checker.last_state)
        run_id = _log_run(
            **{**run_info, 'template_name': checker_json.get('template_name') or run_info['template_name']},
            duration_ms=duration_ms,
            results_json=checker_json,
            status='completed' if completed else 'rejected',
            stopped_at_stage=stopped_at_stage,
            error_message=None if completed else first_error_message(checker_json),
        )
    except Exception as e:
        current_app.logger.exception('Template check failed')
        _log_run(
            **run_info,
            duration_ms=int((time.time() - start_time) * 1000),
            status='failed',
            stopped_at_stage=_state_name(getattr(checker, 'last_state', None)),
            error_message=f'{type(e).__name__}: {e}',
        )
        raise CheckFailed() from e
    return CheckOutcome(checker_json, completed, stopped_at_stage, run_id, summary)


def _build_summary(results: dict) -> Optional[CustomerSummary]:
    """The customer summary, or None (logged) if writing it fails: the check results are still worth returning."""
    try:
        return build_customer_summary(results)
    except Exception:
        current_app.logger.exception('Failed to build the customer summary')
        return None


def start_check(checker, file_path: str, source_type: str = 'api', user_id: Optional[str] = None):
    """Run the checker and return the /run response: the results JSON, or a 500 if the checker crashed."""
    try:
        outcome = run_check(checker, file_path, source_type, user_id)
    except CheckFailed:
        return jsonify({'error': 'An error occurred during the check.'}), 500
    return jsonify({'type': 'data', 'content': {'results': outcome.results}}), 200


def _state_name(state) -> Optional[str]:
    return state.name if state is not None else None


def checker_cleanup(checker):
    """Cleanup the checker and remove this request's uploaded files (only this request's folder)."""
    checker.delete_unzipped_root_path()
    upload_dir = g.pop('upload_dir', None)
    if upload_dir:
        shutil.rmtree(upload_dir, ignore_errors=True)
