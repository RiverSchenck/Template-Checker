import os
import json
import time
import jwt
import urllib.request
from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, jsonify, send_file, after_this_request, request, current_app, g
from src.classes.FrontifyChecker import FrontifyChecker
from .utils import upload_file, start_check, checker_cleanup, download_file_from_url
from .analytics_api import get_analytics_summary, get_runs, get_supabase_client
from . import users as user_helpers

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
        if not user_helpers.is_admin(email=email, auth_user_id=user_id):
            return jsonify({
                'error': {'message': 'Forbidden', 'details': 'Admin role required'}
            }), 403
        return f(*args, **kwargs)
    return decorated_function


@main.route('/me', methods=['GET'])
@require_auth
def me():
    """Return current user and role from users table. 403 if not approved."""
    user_id = _current_user_id()
    if not user_id:
        return jsonify({
            'error': {'message': 'Authentication required', 'details': 'Valid Supabase JWT required'}
        }), 401
    email = (_current_user_email() or '').strip().lower()
    if not email:
        return jsonify({
            'error': {'message': 'Authentication required', 'details': 'Email required'}
        }), 401
    user_row = user_helpers.get_user_by_email(email)
    if not user_row:
        return jsonify({
            'error': {'message': 'Access not authorized', 'code': 'access_denied'},
            'allowed': False,
        }), 403
    user_metadata = g.supabase_jwt.get('user_metadata') or {}
    display_name = user_metadata.get('full_name') or user_metadata.get('name') or user_metadata.get('email') or email
    avatar_url = user_metadata.get('avatar_url') or user_metadata.get('picture')
    updated = user_helpers.upsert_user_on_signin(
        auth_user_id=user_id,
        email=email,
        display_name=display_name,
        avatar_url=avatar_url,
    )
    row = updated if updated else user_row
    return jsonify({
        'id': str(row.get('id')),
        'email': row.get('email') or email,
        'display_name': row.get('display_name') or display_name,
        'avatar_url': row.get('avatar_url'),
        'role': row.get('role', 'user'),
    }), 200


@main.route('/admin/users', methods=['GET'])
@require_auth
@require_admin
def admin_list_users():
    """List approved users from users table (admin only)."""
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        r = supabase.table('users').select('id, email, role, display_name, avatar_url, auth_user_id, approved_by, created_at, updated_at, last_seen_at').order('created_at', desc=True).execute()
        rows = r.data if r.data else []
        result = []
        for row in rows:
            result.append({
                'id': str(row['id']),
                'email': row.get('email') or '',
                'display_name': row.get('display_name'),
                'avatar_url': row.get('avatar_url'),
                'auth_user_id': str(row['auth_user_id']) if row.get('auth_user_id') else None,
                'approved_by': str(row['approved_by']) if row.get('approved_by') else None,
                'role': row.get('role', 'user'),
                'created_at': row.get('created_at'),
                'updated_at': row.get('updated_at'),
                'last_seen_at': row.get('last_seen_at'),
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/users/<user_id>', methods=['PATCH'])
@require_auth
@require_admin
def admin_update_user_role(user_id):
    """Update a user's role (admin only). user_id is users.id from our table."""
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
        now = datetime.now(timezone.utc).isoformat()
        r = supabase.table('users').update({'role': new_role, 'updated_at': now}).eq('id', user_id).execute()
        if not r.data or len(r.data) == 0:
            return jsonify({'error': {'message': 'User not found'}}), 404
        row = dict(r.data[0])
        auth_user_id = row.get('auth_user_id')
        if auth_user_id:
            try:
                supabase.auth.admin.update_user_by_id(str(auth_user_id), {'app_metadata': {'role': new_role}})
            except Exception:
                pass
        return jsonify({
            'id': str(row['id']),
            'email': row.get('email'),
            'display_name': row.get('display_name'),
            'avatar_url': row.get('avatar_url'),
            'role': row.get('role'),
            'created_at': row.get('created_at'),
            'updated_at': row.get('updated_at'),
        }), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/users/<user_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_delete_user(user_id):
    """Remove user access (admin only). user_id is users.id. Cannot delete self. Does not delete from Auth."""
    if not user_id:
        return jsonify({'error': {'message': 'user_id required'}}), 400
    email = _current_user_email() or ''
    current_user_row = user_helpers.get_user_by_email(email)
    if current_user_row and str(current_user_row.get('id')) == str(user_id):
        return jsonify({'error': {'message': 'Cannot delete your own account'}}), 403
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        supabase.table('users').delete().eq('id', user_id).execute()
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500
    return '', 204


def _validate_email(email):
    """Validate email format. Returns (normalized_email, error_message)."""
    if not email or not isinstance(email, str):
        return None, 'Email is required'
    email = email.strip().lower()
    if not email:
        return None, 'Email is required'
    if '@' not in email or '.' not in email.split('@')[-1]:
        return None, 'Invalid email format'
    return email, None


@main.route('/access-requests', methods=['POST'])
def post_access_request():
    """Submit an access request. With valid JWT: use email (and name/avatar) from token, idempotent. Without: body { \"email\": \"...\" }."""
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Service unavailable'}}), 503

    # Try JWT from Authorization header
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
    elif auth_header:
        token = auth_header.strip()
    if token:
        payload = verify_supabase_token(token)
        if payload:
            email = (payload.get('email') or '').strip().lower()
            if not email or '@' not in email:
                return jsonify({'error': {'message': 'Invalid email in token'}}), 400
            user_metadata = payload.get('user_metadata') or {}
            display_name = user_metadata.get('full_name') or user_metadata.get('name') or user_metadata.get('email')
            avatar_url = user_metadata.get('avatar_url') or user_metadata.get('picture')
            # Idempotent: if pending request exists for this email, return it
            try:
                existing = supabase.table('access_requests').select('id, email, status, created_at').eq('status', 'pending').eq('email', email).limit(1).execute()
                if existing.data and len(existing.data) > 0:
                    row = dict(existing.data[0])
                    return jsonify({
                        'id': str(row['id']),
                        'email': row['email'],
                        'status': row['status'],
                    }), 200
            except Exception:
                pass
            # Insert new request (schema: email, status, optional why_need_access from JWT path)
            try:
                body_why = (request.get_json(silent=True) or {}).get('why_need_access') if request.is_json else None
                why_need_access = (body_why or '').strip() or None
                r = supabase.table('access_requests').insert({'email': email, 'status': 'pending', 'why_need_access': why_need_access}).execute()
            except Exception as e:
                current_app.logger.exception('access_requests insert failed')
                return jsonify({'error': {'message': str(e)}}), 500
            if not r.data or len(r.data) == 0:
                return jsonify({'error': {'message': 'Failed to create request'}}), 500
            row = dict(r.data[0])
            return jsonify({
                'id': str(row['id']),
                'email': row['email'],
                'status': row['status'],
            }), 201

    # No valid JWT: require JSON body with email and why_need_access
    if not request.is_json:
        return jsonify({'error': {'message': 'Request must be JSON with email and why_need_access or provide Authorization'}}), 400
    data = request.get_json() or {}
    email, err = _validate_email(data.get('email'))
    if err:
        return jsonify({'error': {'message': err}}), 400
    why = (data.get('why_need_access') or '').strip()
    if not why:
        return jsonify({'error': {'message': 'Please tell us why you need access.'}}), 400
    try:
        r = supabase.table('access_requests').insert({
            'email': email,
            'status': 'pending',
            'why_need_access': why,
        }).execute()
        if not r.data or len(r.data) == 0:
            return jsonify({'error': {'message': 'Failed to create request'}}), 500
        row = dict(r.data[0])
        return jsonify({
            'id': str(row['id']),
            'email': row['email'],
            'status': row['status'],
        }), 201
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/access-requests', methods=['GET'])
@require_auth
@require_admin
def admin_list_access_requests():
    """List access requests (admin only). Default: pending only. ?status=all for all."""
    status_filter = request.args.get('status', 'pending')
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    try:
        q = supabase.table('access_requests').select('id, email, why_need_access, status, created_at, updated_at, decided_by').order('created_at', desc=True)
        if status_filter != 'all':
            q = q.eq('status', status_filter)
        r = q.execute()
        rows = r.data if r.data else []
        result = [{'id': str(x['id']), 'email': x['email'], 'why_need_access': x.get('why_need_access'), 'status': x['status'], 'created_at': x.get('created_at'), 'updated_at': x.get('updated_at'), 'decided_by': str(x['decided_by']) if x.get('decided_by') else None} for x in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/access-requests/<request_id>', methods=['PATCH'])
@require_auth
@require_admin
def admin_update_access_request(request_id):
    """Approve or reject an access request (admin only). Body: { "status": "approved" | "rejected" }."""
    if not request_id:
        return jsonify({'error': {'message': 'request_id required'}}), 400
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in ('approved', 'rejected'):
        return jsonify({'error': {'message': 'status must be "approved" or "rejected"'}}), 400
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 500
    current_user_id = _current_user_id()
    try:
        r = supabase.table('access_requests').select('*').eq('id', request_id).limit(1).execute()
        if not r.data or len(r.data) == 0:
            return jsonify({'error': {'message': 'Request not found'}}), 404
        req = dict(r.data[0])
        # Allow approving pending or rejected; allow rejecting only pending
        if new_status == 'approved':
            if req['status'] not in ('pending', 'rejected'):
                return jsonify({'error': {'message': 'Request already approved'}}), 400
        else:  # rejected
            if req['status'] != 'pending':
                return jsonify({'error': {'message': 'Only pending requests can be rejected'}}), 400
        now = datetime.now(timezone.utc).isoformat()
        if new_status == 'approved':
            email = (req.get('email') or '').strip().lower()
            if not email:
                return jsonify({'error': {'message': 'Invalid request email'}}), 400
            admin_row = user_helpers.get_user_by_auth_id(current_user_id) if current_user_id else None
            approved_by_id = str(admin_row['id']) if admin_row and admin_row.get('id') else None
            user_insert = {
                'email': email,
                'role': 'user',
            }
            if approved_by_id:
                user_insert['approved_by'] = approved_by_id
            try:
                supabase.table('users').insert(user_insert).execute()
            except Exception as insert_err:
                if 'duplicate' in str(insert_err).lower() or 'unique' in str(insert_err).lower():
                    pass
                else:
                    return jsonify({'error': {'message': str(insert_err)}}), 500
        supabase.table('access_requests').update({
            'status': new_status,
            'updated_at': now,
            'decided_by': current_user_id,
        }).eq('id', request_id).execute()
        r2 = supabase.table('access_requests').select('*').eq('id', request_id).limit(1).execute()
        row = dict(r2.data[0]) if r2.data and len(r2.data) > 0 else req
        return jsonify({
            'id': str(row['id']),
            'email': row['email'],
            'why_need_access': row.get('why_need_access'),
            'status': row['status'],
            'created_at': row.get('created_at'),
            'updated_at': row.get('updated_at'),
            'decided_by': str(row['decided_by']) if row.get('decided_by') else None,
        }), 200
    except Exception as e:
        return jsonify({'error': {'message': str(e)}}), 500


@main.route('/admin/invites', methods=['POST'])
@require_auth
@require_admin
def admin_invite():
    """Invite a user by email (admin only). Body: { "email": "..." }."""
    if not request.is_json:
        return jsonify({'error': {'message': 'Request must be JSON with email field'}}), 400
    data = request.get_json() or {}
    email, err = _validate_email(data.get('email'))
    if err:
        return jsonify({'error': {'message': err}}), 400
    supabase = get_supabase_client()
    if not supabase:
        return jsonify({'error': {'message': 'Supabase not configured'}}), 503
    admin_row = user_helpers.get_user_by_auth_id(_current_user_id()) if _current_user_id() else None
    approved_by_id = str(admin_row['id']) if admin_row and admin_row.get('id') else None
    user_insert = {'email': email, 'role': 'user'}
    if approved_by_id:
        user_insert['approved_by'] = approved_by_id
    try:
        r = supabase.table('users').insert(user_insert).execute()
        if not r.data or len(r.data) == 0:
            return jsonify({'error': {'message': 'Failed to create invite'}}), 500
        row = dict(r.data[0])
        return jsonify({
            'id': str(row['id']),
            'email': row['email'],
            'role': row.get('role', 'user'),
            'created_at': row.get('created_at'),
        }), 201
    except Exception as e:
        if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
            return jsonify({'error': {'message': 'User already invited or approved'}}), 409
        return jsonify({'error': {'message': str(e)}}), 500


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
        auth_uid = _current_user_id()
        user_row = user_helpers.get_user_by_auth_id(auth_uid) if auth_uid else None
        run_user_id = str(user_row['id']) if user_row and user_row.get('id') else None
        results, status_code = start_check(checker, upload_path, source_type, user_id=run_user_id)
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

        # Fixed max size of 200MB (matching upload limit; safe for 256MB Fly machine)
        max_size_bytes = 200 * 1024 * 1024  # 200MB

        # Download the file from URL
        download_result = download_file_from_url(download_url, max_size_bytes)
        if download_result['status'] != 'success':
            return jsonify(download_result['error']), 400

        download_path = download_result['path']

        # Run the checker on the downloaded file
        auth_uid = _current_user_id()
        user_row = user_helpers.get_user_by_auth_id(auth_uid) if auth_uid else None
        run_user_id = str(user_row['id']) if user_row and user_row.get('id') else None
        results, status_code = start_check(checker, download_path, source_type, user_id=run_user_id)
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
