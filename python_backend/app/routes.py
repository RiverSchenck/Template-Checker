import os
import jwt
from functools import wraps
from flask import Blueprint, jsonify, send_file, after_this_request, request, current_app, Response
from src.classes.FrontifyChecker import FrontifyChecker
from .utils import upload_file, start_check, checker_cleanup, download_file_from_url
from .analytics_api import get_analytics_summary, get_runs

main = Blueprint('main', __name__)


def verify_supabase_token(token):
    """Verify a Supabase JWT token."""
    try:
        supabase_jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
        if not supabase_jwt_secret:
            return None

        # Decode and verify the JWT token
        decoded = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=['HS256'],
            options={"verify_signature": True, "verify_exp": True, "verify_iat": True}
        )
        return decoded
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None


def require_auth(f):
    """Decorator to require authentication token for endpoints.
    Supports both Supabase JWT tokens and static AUTH_TOKEN for backward compatibility."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get token from Authorization header or query parameter
        provided_token = None

        # Try Authorization header first (format: "Bearer <token>" or just "<token>")
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            provided_token = auth_header[7:]
        elif auth_header:
            provided_token = auth_header

        # Fallback to query parameter
        if not provided_token:
            provided_token = request.args.get('token')

        if not provided_token:
            # Check if auth is required (either AUTH_TOKEN or SUPABASE_JWT_SECRET configured)
            auth_token = current_app.config.get('AUTH_TOKEN')
            supabase_jwt_secret = os.getenv('SUPABASE_JWT_SECRET')

            if not auth_token and not supabase_jwt_secret:
                # If no auth is configured, allow access (for development/testing)
                return f(*args, **kwargs)

            return jsonify({
                'error': {
                    'message': 'Authentication required',
                    'details': 'Invalid or missing authentication token'
                }
            }), 401

        # First, try to verify as Supabase JWT token
        supabase_payload = verify_supabase_token(provided_token)
        if supabase_payload:
            # Valid Supabase token
            return f(*args, **kwargs)

        # Fallback to static AUTH_TOKEN for backward compatibility
        auth_token = current_app.config.get('AUTH_TOKEN')
        if auth_token and provided_token == auth_token:
            return f(*args, **kwargs)

        # If no auth is configured, allow access (for development/testing)
        if not auth_token and not os.getenv('SUPABASE_JWT_SECRET'):
            return f(*args, **kwargs)

        # Token validation failed
        return jsonify({
            'error': {
                'message': 'Authentication required',
                'details': 'Invalid or missing authentication token'
            }
        }), 401

    return decorated_function


@main.route('/test')
def test_cors():
    """Test endpoint to verify CORS."""
    return jsonify({'message': 'Yep, it\'s on.'})


@main.route('/run', methods=['POST'])
@require_auth
def run_checker():
    """Endpoint to run the checker and return results."""
    checker = FrontifyChecker()
    try:
        # Get source type from header, default to 'api'
        source_type = request.headers.get('X-Source', 'api')

        upload_result = upload_file()
        if upload_result['status'] != 'success':
            return jsonify(upload_result['error']), 400

        upload_path = upload_result['path']
        results, status_code = start_check(checker, upload_path, source_type)
        return results, status_code
    finally:
        checker_cleanup(checker)


@main.route('/run-and-download-xml', methods=['POST'])
@require_auth
def run_checker_and_download():
    """Endpoint to run the checker and download the resulting ZIP file."""
    checker = FrontifyChecker()
    zip_file_path = None
    try:
        # Get source type from header, default to 'api'
        source_type = request.headers.get('X-Source', 'api')

        upload_result = upload_file()
        if upload_result['status'] != 'success':
            return jsonify(upload_result['error']), 400

        upload_path = upload_result['path']
        results, status_code = start_check(checker, upload_path, source_type)
        if status_code != 200:
            return results, status_code

        template_name = checker.get_template_name()
        zip_file_path = checker.zip_idml_output_folder()

        if not zip_file_path:
            return jsonify({'error': 'Failed to create the ZIP file'}), 500

        # Verify the file exists before attempting to send
        if not os.path.exists(zip_file_path) or not os.path.isfile(zip_file_path):
            return jsonify({'error': f'ZIP file does not exist at path: {zip_file_path}'}), 500

        print(f"ZIP FILE PATH: {zip_file_path}, EXISTS: {os.path.exists(zip_file_path)}, SIZE: {os.path.getsize(zip_file_path) if os.path.exists(zip_file_path) else 0}")

        # Store zip_file_path in a way that cleanup function can access it
        # Using closure to capture zip_file_path
        zip_path_for_cleanup = zip_file_path

        @after_this_request
        def cleanup(response):
            # Cleanup checker resources (unzipped files, uploaded files)
            checker_cleanup(checker)
            # Also cleanup the ZIP file from temp directory after response is sent
            if zip_path_for_cleanup and os.path.exists(zip_path_for_cleanup):
                try:
                    os.remove(zip_path_for_cleanup)
                    print(f"Cleaned up ZIP file: {zip_path_for_cleanup}")
                except Exception as e:
                    print(f'Failed to delete ZIP file {zip_path_for_cleanup}. Reason: {e}')
            return response

        try:
            return send_file(
                path_or_file=zip_file_path,
                mimetype='application/zip',
                as_attachment=True,
                download_name=f"{template_name}.zip"
            )
        except Exception as e:
            print(f"Error sending file: {e}")
            # Cleanup ZIP file on exception (before @after_this_request runs)
            if zip_file_path and os.path.exists(zip_file_path):
                try:
                    os.remove(zip_file_path)
                    print(f"Cleaned up ZIP file in exception handler: {zip_file_path}")
                except Exception as e2:
                    print(f'Failed to delete ZIP file in exception handler: {e2}')
            return jsonify({'error': 'Failed to send the ZIP file', 'details': str(e)}), 500
    finally:
        # Always cleanup checker resources (unzipped files, uploaded files)
        # This handles early returns where @after_this_request never runs
        checker_cleanup(checker)
        # Note: We DON'T delete zip_file_path here because:
        # 1. @after_this_request handles cleanup after successful file send
        # 2. Exception handler handles cleanup if send_file fails
        # 3. If we delete here, it happens BEFORE send_file finishes streaming, causing failures


@main.route('/run-from-url', methods=['POST'])
@require_auth
def run_checker_from_url():
    """Endpoint to download a ZIP file from a URL and run the checker on it."""
    checker = FrontifyChecker()
    try:
        # Get source type from header, default to 'api'
        source_type = request.headers.get('X-Source', 'api')

        # Get downloadUrl from request JSON
        if not request.is_json:
            return jsonify({'error': {'message': 'Request must be JSON with downloadUrl field'}}), 400

        data = request.get_json()
        if not data or 'downloadUrl' not in data:
            return jsonify({'error': {'message': 'downloadUrl is required'}}), 400

        download_url = data['downloadUrl']

        # Fixed max size of 300MB (matching upload limit and preventing abuse)
        max_size_bytes = 300 * 1024 * 1024  # 300MB

        # Download the file from URL
        download_result = download_file_from_url(download_url, max_size_bytes)
        if download_result['status'] != 'success':
            return jsonify(download_result['error']), 400

        download_path = download_result['path']

        # Run the checker on the downloaded file
        results, status_code = start_check(checker, download_path, source_type)
        return results, status_code
    finally:
        checker_cleanup(checker)


@main.route('/analytics/summary', methods=['GET'])
@require_auth
def analytics_summary():
    """Endpoint to get analytics summary."""
    try:
        days = request.args.get('days', 30, type=int)
        summary = get_analytics_summary(days=days)

        if 'error' in summary:
            return jsonify(summary), 500

        return jsonify(summary), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@main.route('/analytics/runs', methods=['GET'])
@require_auth
def analytics_runs():
    """Endpoint to get paginated list of runs."""
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)

        runs_data = get_runs(limit=limit, offset=offset)

        if 'error' in runs_data:
            return jsonify(runs_data), 500

        return jsonify(runs_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@main.route('/api/extension-token', methods=['GET'])
def get_extension_token():
    """Get AUTH_TOKEN for extension use."""
    auth_token = os.getenv('AUTH_TOKEN')

    if auth_token:
        return jsonify({
            'access_token': auth_token,
            'token_type': 'Bearer'
        })

    return jsonify({
        'error': 'No token available',
        'message': 'Please log in to the web app first'
    }), 401
