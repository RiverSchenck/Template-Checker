import os
import shutil
import time
import uuid
from typing import Optional
from flask import request, current_app, jsonify, g
from werkzeug.utils import secure_filename
from .analytics import log_analytics_to_supabase


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


def start_check(checker, file_path: str, source_type: str = 'api', user_id: Optional[str] = None):
    """Run the checker on the uploaded file and return the results."""
    try:
        # Track start time for duration calculation
        start_time = time.time()

        # Get file size
        file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        checker.set_source_file_path(file_path)
        checker.run_state_machine()

        # Calculate duration in milliseconds
        end_time = time.time()
        duration_ms = int((end_time - start_time) * 1000)

        checker_json = checker.results.get_formatted_results_json()

        # Add analytics data to results
        checker_json['analytics'] = {
            'duration_ms': duration_ms,
            'source_type': source_type,
            'file_size_bytes': file_size_bytes
        }

        # Log analytics to Supabase (non-blocking - don't fail validation if this fails)
        try:
            template_name = checker_json.get('template_name', 'Unknown')
            log_analytics_to_supabase(
                template_name=template_name,
                source_type=source_type,
                duration_ms=duration_ms,
                file_size_bytes=file_size_bytes,
                results_json=checker_json,
                user_id=user_id
            )
        except Exception as e:
            # Log error but don't fail the validation
            print(f"Warning: Failed to log analytics to Supabase: {e}")

        result_json = {
            "type": "data",
            "content": {
                "results": checker_json,
            }
        }
        return jsonify(result_json), 200
    except Exception as e:
        current_app.logger.exception('Template check failed')
        return jsonify({'error': 'An error occurred during the check.'}), 500


def checker_cleanup(checker):
    """Cleanup the checker and remove this request's uploaded files (only this request's folder)."""
    checker.delete_unzipped_root_path()
    upload_dir = g.pop('upload_dir', None)
    if upload_dir:
        shutil.rmtree(upload_dir, ignore_errors=True)
