import os
import json
import time
import jwt
import urllib.request
from functools import wraps
from flask import Blueprint, jsonify, send_file, after_this_request, request, current_app, g
from src.classes.FrontifyChecker import FrontifyChecker
from .utils import upload_file, start_check, checker_cleanup, download_file_from_url
from .analytics_api import get_analytics_summary, get_runs, get_supabase_client
from . import profiles as profile_helpers

main = Blueprint('main', __name__)

# Cache JWKS for 10 minutes so we don't hit the discovery endpoint on every request
_jwks_cache = {"data": None, "expires": 0}
JWKS_CACHE_TTL = 600


def _fetch_jwks():
    """Fetch Supabase Auth JWKS from the well-known endpoint. No secret needed."""
    global _jwks_cache
    now = time.time()
    if _jwks_cache["data"] is not None and now < _jwks_cache["expires"]:
        return _jwks_cache["data"]
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        current_app.logger.warning("JWT verification: SUPABASE_URL not set, cannot fetch JWKS")
        return None
    url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        _jwks_cache["data"] = data
        _jwks_cache["expires"] = now + JWKS_CACHE_TTL
        return data
    except Exception as e:
        current_app.logger.warning("JWT verification: JWKS fetch failed: %s", e)
        return None


def _verify_supabase_token_jwks(token):
    """Verify Supabase JWT using public keys from JWKS (works with new Signing keys; no secret)."""
    try:
        from jose import jwk as jose_jwk
        from jose import jwt as jose_jwt
    except ImportError:
        current_app.logger.warning("JWT verification: python-jose not installed")
        return None
    jwks = _fetch_jwks()
    if not jwks or "keys" not in jwks:
        return None
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as e:
        # Not a JWT (e.g. static AUTH_TOKEN or empty) — skip JWKS without logging
        if "segments" not in str(e).lower():
            current_app.logger.warning("JWT verification: invalid token header: %s", e)
        return None
    kid = unverified.get("kid")
    alg = unverified.get("alg")
    if not kid or alg not in ("ES256", "RS256"):
        current_app.logger.debug(
            "JWT verification: token has kid=%s alg=%s (need kid and ES256/RS256)", kid, alg
        )
        return None
    for key_dict in jwks["keys"]:
        if key_dict.get("kid") == kid:
            try:
                key = jose_jwk.construct(key_dict)
                payload = jose_jwt.decode(
                    token,
                    key,
                    algorithms=["ES256", "RS256"],
                    options={"verify_exp": True, "verify_iat": True, "verify_aud": False},
                )
                return payload
            except Exception as e:
                current_app.logger.warning("JWT verification: JWKS decode failed for kid=%s: %s", kid, e)
                return None
    current_app.logger.warning("JWT verification: no JWKS key found for kid=%s", kid)
    return None


def _verify_supabase_token_legacy(token):
    """Verify using legacy JWT secret (HS256). Requires SUPABASE_JWT_SECRET."""
    try:
        supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        if not supabase_jwt_secret:
            return None
        decoded = jwt.decode(
            token,
            supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_signature": True, "verify_exp": True, "verify_iat": True},
        )
        return decoded
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, Exception):
        return None


def verify_supabase_token(token):
    """Verify a Supabase JWT. Tries JWKS first (no secret), then legacy JWT secret."""
    payload = _verify_supabase_token_jwks(token)
    if payload:
        return payload
    return _verify_supabase_token_legacy(token)


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
            # Auth required if any of: AUTH_TOKEN, legacy SUPABASE_JWT_SECRET, or SUPABASE_URL (for JWKS)
            auth_token = current_app.config.get('AUTH_TOKEN')
            supabase_jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
            supabase_url = os.getenv('SUPABASE_URL')

            if not auth_token and not supabase_jwt_secret and not supabase_url:
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
            g.supabase_jwt = supabase_payload
            return f(*args, **kwargs)

        # Fallback to static AUTH_TOKEN for backward compatibility
        auth_token = current_app.config.get('AUTH_TOKEN')
        if auth_token and provided_token == auth_token:
            return f(*args, **kwargs)

        # If no auth is configured, allow access (for development/testing)
        if not auth_token and not os.getenv('SUPABASE_JWT_SECRET') and not os.getenv('SUPABASE_URL'):
            return f(*args, **kwargs)

        # Token validation failed
        return jsonify({
            'error': {
                'message': 'Authentication required',
                'details': 'Invalid or missing authentication token'
            }
        }), 401

    return decorated_function


def _current_user_id():
    """Return current user id from Supabase JWT in g, or None."""
    if not hasattr(g, 'supabase_jwt') or not g.supabase_jwt:
        return None
    return g.supabase_jwt.get('sub')


def _current_user_email():
    """Return current user email from Supabase JWT in g, or None."""
    if not hasattr(g, 'supabase_jwt') or not g.supabase_jwt:
        return None
    return g.supabase_jwt.get('email')


def require_admin(f):
    """Decorator that requires the user to be an admin (after require_auth)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'supabase_jwt') or not g.supabase_jwt:
            return jsonify({
                'error': {'message': 'Authentication required', 'details': 'Supabase JWT required for admin'}
            }), 401
        user_id = g.supabase_jwt.get('sub')
        email = g.supabase_jwt.get('email') or ''
        if not profile_helpers.is_admin(user_id, email=email):
            return jsonify({
                'error': {'message': 'Forbidden', 'details': 'Admin role required'}
            }), 403
        return f(*args, **kwargs)
    return decorated_function


@main.route('/me', methods=['GET'])
@require_auth
def me():
    """Return current user and role (from profiles). Creates profile if missing."""
    user_id = _current_user_id()
    if not user_id:
        return jsonify({
            'error': {'message': 'Authentication required', 'details': 'Valid Supabase JWT required'}
        }), 401
    email = _current_user_email() or ''
    user_metadata = g.supabase_jwt.get('user_metadata') or {}
    display_name = user_metadata.get('full_name') or user_metadata.get('name') or user_metadata.get('email') or email
    role = profile_helpers.ensure_profile_and_get_role(user_id, email=email, display_name=display_name)
    profile = profile_helpers.get_profile(user_id)
    if profile:
        display_name = profile.get('display_name') or display_name
    return jsonify({
        'id': user_id,
        'email': email,
        'display_name': display_name,
        'role': role,
    }), 200


@main.route('/admin/users', methods=['GET'])
@require_auth
@require_admin
def admin_list_users():
    """List all users with their roles (admin only)."""
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        r = supabase.auth.admin.list_users()
        # Response shape: may be r.users or r with .users attribute
        users_list = getattr(r, 'users', None) or getattr(r, 'data', None) or (r if isinstance(r, list) else [])
        if not isinstance(users_list, list):
            users_list = []
        profiles_by_id = {}
        try:
            profiles_r = supabase.table('profiles').select('id, role, display_name, email').execute()
            if profiles_r.data:
                for row in profiles_r.data:
                    profiles_by_id[str(row['id'])] = row
        except Exception:
            pass
        result = []
        for u in users_list:
            uid = u.get('id') if isinstance(u, dict) else getattr(u, 'id', None)
            if not uid:
                continue
            uid_str = str(uid)
            profile = profiles_by_id.get(uid_str) or profile_helpers.get_profile(uid_str)
            email = u.get('email') if isinstance(u, dict) else getattr(u, 'email', None) or ''
            um = u.get('user_metadata') if isinstance(u, dict) else getattr(u, 'user_metadata', None) or {}
            created = u.get('created_at') if isinstance(u, dict) else getattr(u, 'created_at', None)
            display_name = (um.get('full_name') or um.get('name') or um.get('email') or email) if um else email
            if profile:
                display_name = profile.get('display_name') or display_name
                role = profile.get('role', 'user')
            else:
                role = 'admin' if (email and email.lower() in profile_helpers.get_allowed_admin_emails()) else 'user'
            result.append({
                'id': uid_str,
                'email': email,
                'display_name': display_name or email,
                'role': role,
                'created_at': created,
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/users/<user_id>', methods=['PATCH'])
@require_auth
@require_admin
def admin_update_user_role(user_id):
    """Update a user's role (admin only)."""
    if not user_id:
        return jsonify({'error': {'message': 'user_id required'}}), 400
    data = request.get_json(silent=True) or {}
    new_role = data.get('role')
    if new_role not in ('user', 'admin'):
        return jsonify({'error': {'message': 'role must be "user" or "admin"'}}), 400
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        profile = profile_helpers.get_profile(user_id)
        email = (profile or {}).get('email') if profile else None
        display_name = (profile or {}).get('display_name') if profile else None
        try:
            ur = supabase.auth.admin.get_user_by_id(user_id)
            u = getattr(ur, 'user', None) or (getattr(ur, 'users', None) or [None])[0] if getattr(ur, 'users', None) else getattr(ur, 'user', None)
            if u:
                email = u.get('email') if isinstance(u, dict) else getattr(u, 'email', None) or email
                um = u.get('user_metadata') if isinstance(u, dict) else getattr(u, 'user_metadata', None) or {}
                if um:
                    display_name = (um.get('full_name') or um.get('name') or um.get('email')) if isinstance(um, dict) else display_name
        except Exception:
            pass
        profile_helpers.upsert_profile(user_id, email=email, display_name=display_name, role=new_role)
        try:
            supabase.auth.admin.update_user_by_id(user_id, {'app_metadata': {'role': new_role}})
        except Exception:
            pass
        updated = profile_helpers.get_profile(user_id)
        return jsonify(updated or {'id': user_id, 'role': new_role}), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/users/<user_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_delete_user(user_id):
    """Delete a user (admin only). Cannot delete self."""
    current_id = _current_user_id()
    if current_id and str(user_id) == str(current_id):
        return jsonify({'error': {'message': 'Cannot delete your own account'}}), 403
    if not user_id:
        return jsonify({'error': {'message': 'user_id required'}}), 400
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500
    try:
        supabase.table('profiles').delete().eq('id', user_id).execute()
    except Exception:
        pass
    return '', 204


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
