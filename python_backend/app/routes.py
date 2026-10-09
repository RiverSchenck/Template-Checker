import os
import json
import time
import jwt
import urllib.request
from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, jsonify, send_file, after_this_request, request, current_app, g
from src.classes.FrontifyChecker import FrontifyChecker
from .utils import upload_file, start_check, checker_cleanup
from .analytics_api import get_analytics_summary, get_runs, get_supabase_client
from . import users as user_helpers
from . import api_keys

main = Blueprint('main', __name__)


def _internal_error(message='Something went wrong. Please try again.'):
    """Log the active exception server-side and return a generic 500 (never leak exception text to clients)."""
    current_app.logger.exception(message)
    return jsonify({'error': {'message': message}}), 500

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
    jwks = _fetch_jwks()
    if not jwks or "keys" not in jwks:
        return None
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as e:
        # Not a JWT (e.g. empty or malformed) — skip JWKS without logging
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
                key = jwt.PyJWK(key_dict).key
                payload = jwt.decode(
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


def _auth_error(details):
    return jsonify({'error': {'message': 'Authentication required', 'details': details}}), 401


def require_auth(f=None, *, allow_api_key=False):
    """Require a valid Supabase JWT belonging to an approved user (a row in the users table).

    With allow_api_key=True, a per-user API key (`tc_...`) is also accepted. Only the checker routes opt in;
    admin, analytics and key-management routes stay browser-login only, so a leaked key cannot mint more keys.

    Fails closed: no static tokens, no query-string tokens, and no open access when auth is unconfigured.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header

            if allow_api_key and api_keys.looks_like_api_key(token):
                user_row = api_keys.resolve_key(token)
                if not user_row:
                    return _auth_error('Invalid, expired or revoked API key')
                g.api_key_user = user_row
                return f(*args, **kwargs)

            payload = verify_supabase_token(token) if token else None
            if not payload:
                return _auth_error('Invalid or missing authentication token')
            g.supabase_jwt = payload

            # A Supabase login alone is not enough: anyone can sign in with Google. Only approved users may call the API.
            email = (payload.get('email') or '').strip().lower()
            if not email or not user_helpers.get_user_by_email(email):
                return jsonify({
                    'error': {'message': 'Access not authorized', 'code': 'access_denied'},
                    'allowed': False,
                }), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator(f) if f else decorator


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


def _current_users_row():
    """Return the caller's users row (from API key or Supabase JWT), or None."""
    if getattr(g, 'api_key_user', None):
        return g.api_key_user
    email = (_current_user_email() or '').strip().lower()
    return user_helpers.get_user_by_email(email) if email else None


def _run_source_and_user_id():
    """Source type and users.id to attribute a checker run to. API-key calls are always recorded as 'api'."""
    user_row = _current_users_row()
    user_id = str(user_row['id']) if user_row and user_row.get('id') else None
    if getattr(g, 'api_key_user', None):
        return 'api', user_id
    return request.headers.get('X-Source', 'api'), user_id


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
        # Use * so missing optional columns (e.g. added_via before migration) do not break the query.
        r = supabase.table('users').select('*').order('created_at', desc=True).execute()
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
                'added_via': row.get('added_via'),
                'role': row.get('role', 'user'),
                'created_at': row.get('created_at'),
                'updated_at': row.get('updated_at'),
                'last_seen_at': row.get('last_seen_at'),
            })
        return jsonify(result), 200
    except Exception as e:
        return _internal_error()


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
            'added_via': row.get('added_via'),
            'created_at': row.get('created_at'),
            'updated_at': row.get('updated_at'),
        }), 200
    except Exception as e:
        return _internal_error()


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
        return _internal_error()
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
                return _internal_error()
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
        return _internal_error()


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
        return _internal_error()


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
                'added_via': 'access_request',
            }
            if approved_by_id:
                user_insert['approved_by'] = approved_by_id
            try:
                supabase.table('users').insert(user_insert).execute()
            except Exception as insert_err:
                if 'duplicate' in str(insert_err).lower() or 'unique' in str(insert_err).lower():
                    pass
                else:
                    return _internal_error('Failed to create user for this request.')
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
        return _internal_error()


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
    user_insert = {'email': email, 'role': 'user', 'added_via': 'invite'}
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
            'added_via': row.get('added_via'),
            'created_at': row.get('created_at'),
        }), 201
    except Exception as e:
        if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
            return jsonify({'error': {'message': 'User already invited or approved'}}), 409
        return _internal_error()


def _api_key_response(row):
    return {
        'id': str(row['id']),
        'name': row.get('name'),
        'key_prefix': row.get('key_prefix'),
        'created_at': row.get('created_at'),
        'expires_at': row.get('expires_at'),
        'last_used_at': row.get('last_used_at'),
        'revoked_at': row.get('revoked_at'),
        'active': api_keys.is_active(row),
    }


@main.route('/api-keys', methods=['GET'])
@require_auth
def list_my_api_keys():
    """List the caller's API keys (never the key itself)."""
    user_row = _current_users_row()
    if not user_row:
        return jsonify({'error': {'message': 'Access not authorized', 'code': 'access_denied'}}), 403
    try:
        return jsonify([_api_key_response(row) for row in api_keys.list_keys(str(user_row['id']))]), 200
    except Exception:
        return _internal_error()


@main.route('/api-keys', methods=['POST'])
@require_auth
def create_my_api_key():
    """Create an API key for the caller. Body: {"name": "...", "expires_in_days": 90}. The key is returned once."""
    user_row = _current_users_row()
    if not user_row:
        return jsonify({'error': {'message': 'Access not authorized', 'code': 'access_denied'}}), 403
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    if not isinstance(name, str) or not name.strip():
        return jsonify({'error': {'message': 'name is required'}}), 400
    name = name.strip()
    if len(name) > 100:
        return jsonify({'error': {'message': 'name must be 100 characters or fewer'}}), 400
    expires_in_days = data.get('expires_in_days', api_keys.DEFAULT_EXPIRY_DAYS)
    if not isinstance(expires_in_days, int) or isinstance(expires_in_days, bool) \
            or not 1 <= expires_in_days <= api_keys.MAX_EXPIRY_DAYS:
        return jsonify({'error': {
            'message': f'expires_in_days must be a whole number from 1 to {api_keys.MAX_EXPIRY_DAYS}'
        }}), 400
    try:
        user_id = str(user_row['id'])
        if api_keys.count_active_keys(user_id) >= api_keys.MAX_ACTIVE_KEYS_PER_USER:
            return jsonify({'error': {
                'message': f'You can have at most {api_keys.MAX_ACTIVE_KEYS_PER_USER} active keys. Revoke one first.'
            }}), 400
        key, row = api_keys.create_key(user_id, name, expires_in_days)
        return jsonify({**_api_key_response(row), 'key': key}), 201
    except Exception:
        return _internal_error()


@main.route('/api-keys/<key_id>', methods=['DELETE'])
@require_auth
def revoke_my_api_key(key_id):
    """Revoke one of the caller's API keys."""
    user_row = _current_users_row()
    if not user_row:
        return jsonify({'error': {'message': 'Access not authorized', 'code': 'access_denied'}}), 403
    try:
        row = api_keys.get_key(key_id)
        # Same 404 for "not found" and "not yours" so key ids cannot be probed.
        if not row or str(row.get('user_id')) != str(user_row['id']):
            return jsonify({'error': {'message': 'API key not found'}}), 404
        api_keys.revoke_key(key_id)
    except Exception:
        return _internal_error()
    return '', 204


@main.route('/admin/api-keys', methods=['GET'])
@require_auth
@require_admin
def admin_list_api_keys():
    """List every user's API keys with the owner's email (admin only)."""
    try:
        rows = api_keys.list_keys()
        emails = {}
        supabase = get_supabase_client()
        user_ids = list({str(row['user_id']) for row in rows})
        if supabase and user_ids:
            r = supabase.table('users').select('id, email').in_('id', user_ids).execute()
            emails = {str(u['id']): u.get('email') for u in (r.data or [])}
        return jsonify([
            {**_api_key_response(row), 'user_id': str(row['user_id']), 'user_email': emails.get(str(row['user_id']))}
            for row in rows
        ]), 200
    except Exception:
        return _internal_error()


@main.route('/admin/api-keys/<key_id>', methods=['DELETE'])
@require_auth
@require_admin
def admin_revoke_api_key(key_id):
    """Revoke any user's API key (admin only)."""
    try:
        if not api_keys.get_key(key_id):
            return jsonify({'error': {'message': 'API key not found'}}), 404
        api_keys.revoke_key(key_id)
    except Exception:
        return _internal_error()
    return '', 204


@main.route('/test')
def test_cors():
    """Test endpoint to verify CORS."""
    return jsonify({'message': 'Yep, it\'s on.'})


@main.route('/run', methods=['POST'])
@require_auth(allow_api_key=True)
def run_checker():
    """Endpoint to run the checker and return results."""
    checker = FrontifyChecker()
    try:
        source_type, run_user_id = _run_source_and_user_id()

        upload_result = upload_file()
        if upload_result['status'] != 'success':
            return jsonify(upload_result['error']), 400

        upload_path = upload_result['path']
        results, status_code = start_check(checker, upload_path, source_type, user_id=run_user_id)
        return results, status_code
    finally:
        checker_cleanup(checker)


@main.route('/run-and-download-xml', methods=['POST'])
@require_auth(allow_api_key=True)
def run_checker_and_download():
    """Endpoint to run the checker and download the resulting ZIP file."""
    checker = FrontifyChecker()
    zip_file_path = None
    try:
        source_type, run_user_id = _run_source_and_user_id()

        upload_result = upload_file()
        if upload_result['status'] != 'success':
            return jsonify(upload_result['error']), 400

        upload_path = upload_result['path']
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
            current_app.logger.exception('Failed to send the ZIP file')
            return jsonify({'error': 'Failed to send the ZIP file'}), 500
    finally:
        # Always cleanup checker resources (unzipped files, uploaded files)
        # This handles early returns where @after_this_request never runs
        checker_cleanup(checker)
        # Note: We DON'T delete zip_file_path here because:
        # 1. @after_this_request handles cleanup after successful file send
        # 2. Exception handler handles cleanup if send_file fails
        # 3. If we delete here, it happens BEFORE send_file finishes streaming, causing failures


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
        current_app.logger.exception('Analytics request failed')
        return jsonify({'error': 'Failed to load analytics'}), 500


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
        current_app.logger.exception('Analytics request failed')
        return jsonify({'error': 'Failed to load analytics'}), 500
