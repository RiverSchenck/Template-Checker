import os
from flask import Blueprint, jsonify, send_file, after_this_request
from src.classes.FrontifyChecker import FrontifyChecker
from .utils import upload_file, start_check, checker_cleanup

main = Blueprint('main', __name__)


@main.route('/test')
def test_cors():
    """Test endpoint to verify CORS."""
    return jsonify({'message': 'Yep, it\'s on.'})


@main.route('/run', methods=['POST'])
def run_checker():
    """Endpoint to run the checker and return results."""
    checker = FrontifyChecker()
    upload_result = upload_file()
    if upload_result['status'] != 'success':
        return jsonify(upload_result['error']), 400

    upload_path = upload_result['path']
    results, status_code = start_check(checker, upload_path)
    checker_cleanup(checker)
    return results, status_code


@main.route('/run-and-download-xml', methods=['POST'])
def run_checker_and_download():
    """Endpoint to run the checker and download the resulting ZIP file."""
    checker = FrontifyChecker()
    upload_result = upload_file()
    if upload_result['status'] != 'success':
        return jsonify(upload_result['error']), 400

    upload_path = upload_result['path']
    results, status_code = start_check(checker, upload_path)
    if status_code != 200:
        return results, status_code

    template_name = checker.get_template_name()
    zip_file_path = checker.zip_idml_output_folder()
    print("FILE PATH ", zip_file_path)
    zip_file_path = os.path.abspath(zip_file_path)

    if zip_file_path:
        @after_this_request
        def cleanup(response):
            checker_cleanup(checker)
            return response
        try:
            return send_file(
                path_or_file=zip_file_path,
                mimetype='application/zip',
                as_attachment=True,
                download_name=f"{template_name}.zip"
            )
        except Exception as e:
            return jsonify({'error': 'Failed to send the ZIP file', 'details': str(e)}), 500
    else:
        checker_cleanup(checker)
        return jsonify({'error': 'Failed to create or locate the ZIP file'}), 500
