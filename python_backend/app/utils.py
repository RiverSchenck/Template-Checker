import os
import time
from dataclasses import dataclass
from typing import Optional
from flask import request, current_app, g
from werkzeug.utils import secure_filename
from src.pipeline.run import StageTracker, run
from src.pipeline.workspace import Workspace
from .analytics import log_analytics_to_supabase, first_error_message
from .customer_summary import CustomerSummary, build_customer_summary, summary_payload


def upload_file():
    """Handle file upload and return the file path or an error."""
    try:
        if 'file' not in request.files:
            return {'status': 'error', 'error': {'message': 'No file part'}}
        file = request.files['file']
        if file.filename == '':
            return {'status': 'error', 'error': {'message': 'No selected file'}}

        filename = secure_filename(file.filename) or 'upload.zip'
        # Into this request's run folder (g.workspace), so concurrent checks never touch each other's files
        save_path = os.path.join(g.workspace.folder('upload'), filename)
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

    def __init__(self, run_id: Optional[str] = None):
        super().__init__()
        self.run_id = run_id
        """The analytics run id of the failed run, or None if logging is off or failed."""


@dataclass(frozen=True)
class CheckOutcome:
    results: dict
    """The checker's results (v2): what the summary, analytics and rejection reasons are read from."""
    completed: bool
    """True when every check ran; False when the upload was rejected (results explain why)."""
    stopped_at_stage: Optional[str]
    run_id: Optional[str]
    """The analytics run id, or None if logging is off or failed."""
    summary: Optional[CustomerSummary]
    """The customer summary, or None if it couldn't be written (logged)."""
    idml_folder: Optional[str] = None
    """The unpacked .idml, once intake got that far (for the XML export)."""

    def response(self) -> dict:
        """What /v1/checks and /run send: the results (v2) and, next to them, the customer summary (with its
        sections, for the web app's review view)."""
        return {'results': self.results,
                'customer_summary': summary_payload(self.summary, include_sections=True) if self.summary else None}


def run_check(file_path: str, workspace: Workspace, source_type: str = 'api', user_id: Optional[str] = None,
              previews: bool = False) -> CheckOutcome:
    """Run the checker on the uploaded file, in the request's run folder. Raises CheckFailed if it crashes.

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
    tracker = StageTracker()
    try:
        outcome = run(file_path, workspace, previews=previews, tracker=tracker)
        duration_ms = int((time.time() - start_time) * 1000)

        results = outcome.json()
        summary = _build_summary(results)

        # A run reaches RESULTS when every check ran; otherwise the upload was rejected at outcome.stage.
        completed = outcome.completed
        stopped_at_stage = None if completed else outcome.stage.name
        run_id = _log_run(
            **{**run_info, 'template_name': results.get('template_name') or run_info['template_name']},
            duration_ms=duration_ms,
            results_json=results,
            status='completed' if completed else 'rejected',
            stopped_at_stage=stopped_at_stage,
            error_message=None if completed else first_error_message(results),
        )
    except Exception as e:
        current_app.logger.exception('Template check failed')
        failed_run_id = _log_run(
            **run_info,
            duration_ms=int((time.time() - start_time) * 1000),
            status='failed',
            stopped_at_stage=_state_name(tracker.stage),
            error_message=f'{type(e).__name__}: {e}',
        )
        raise CheckFailed(failed_run_id) from e
    return CheckOutcome(results, completed, stopped_at_stage, run_id, summary, outcome.idml_folder)


def _build_summary(results: dict) -> Optional[CustomerSummary]:
    """The customer summary, or None (logged) if writing it fails: the check results are still worth returning."""
    try:
        return build_customer_summary(results)
    except Exception:
        current_app.logger.exception('Failed to build the customer summary')
        return None


def _state_name(state) -> Optional[str]:
    return state.name if state is not None else None
