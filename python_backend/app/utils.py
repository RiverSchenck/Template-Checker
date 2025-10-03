import os
import shutil
from flask import request, current_app, jsonify
from werkzeug.utils import secure_filename


def upload_file():
    """Handle file upload and return the file path or an error."""
    try:
        if 'file' not in request.files:
            return {'status': 'error', 'error': {'message': 'No file part'}}
        file = request.files['file']
        if file.filename == '':
            return {'status': 'error', 'error': {'message': 'No selected file'}}

        filename = secure_filename(file.filename)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)

        return {'status': 'success', 'path': save_path}
    except Exception as e:
        return {'status': 'error', 'error': {'message': 'An error occurred during processing.', 'details': str(e)}}


def start_check(checker, file_path: str):
    """Run the checker on the uploaded file and return the results."""
    try:
        checker.set_source_file_path(file_path)
        checker.run_state_machine()

        checker_json = checker.results.get_formatted_results_json()
        result_json = {
            "type": "data",
            "content": {
                "results": checker_json,
            }
        }
        return jsonify(result_json), 200
    except Exception as e:
        return jsonify({'error': 'An error occurred during the check.', 'details': str(e)}), 500


def checker_cleanup(checker):
    """Cleanup the checker and remove uploaded files."""
    checker.delete_unzipped_root_path()
    for file in os.listdir(current_app.config['UPLOAD_FOLDER']):
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')
