import os
import json
import time
import jwt
import urllib.request
from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, Response, jsonify, send_file, request, current_app, g
from src.pipeline.run import zip_idml
from src.pipeline.workspace import run_workspace
from .errors import api_error, error_body
from .utils import CheckFailed, upload_file, run_check
from .analytics import first_error_message, get_app_version
from .customer_summary import display_template_name, summary_payload
from .analytics_api import (
    AnalyticsQueryError, analytics_period, export_runs_csv, get_api_usage, get_issue_detail, get_overview, get_runs,
    get_supabase_client, run_filters,
)
from . import users as user_helpers
from . import api_keys
from . import summary_feedback
from . import rate_limit

main = Blueprint('main', __name__)


def _internal_error(message='Something went wrong. Please try again.'):
    """Log the active exception server-side and return a generic 500 (never leak exception text to clients)."""
    current_app.logger.exception(message)
    return api_error(500, 'internal_error', message)

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
    return api_error(401, 'unauthorized', 'Authentication required', details=details)


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
                # Well-formed keys are logged to api_requests once answered (log_api_request); malformed ones never
                # touch the database.
                g.api_key_request = bool(api_keys.KEY_PATTERN.fullmatch(token))
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
                return jsonify({**error_body('access_denied', 'Access not authorized'), 'allowed': False}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator(f) if f else decorator


@main.before_request
def start_request_timer():
    g.request_started = time.monotonic()


@main.after_request
def log_api_request(response):
    """Record every request made with a well-formed API key (valid or not) in api_requests, for the admin API usage page:
    which key and endpoint, the status and error code, how long it took, and the run it started."""
    if not g.get('api_key_request'):
        return response
    error_code = None
    if response.status_code >= 400 and response.is_json:
        error_code = ((response.get_json(silent=True) or {}).get('error') or {}).get('code')
    user = g.get('api_key_user') or {}
    started = g.get('request_started')
    api_keys.log_request({
        'key_id': g.get('api_key_id'),
        'user_id': str(user['id']) if user.get('id') else None,
        'method': request.method,
        'endpoint': request.url_rule.rule if request.url_rule else request.path,
        'status_code': response.status_code,
        'error_code': error_code,
        'duration_ms': int((time.monotonic() - started) * 1000) if started else None,
        'request_bytes': request.content_length,
        'run_id': g.get('run_id'),
        'request_id': g.get('request_id'),
    })
    return response


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


SOURCE_TYPES = ('react-frontend', 'extension', 'api')


def _run_source():
    """Where a check came from, for analytics: 'react-frontend', 'extension' or 'api'.

    Worked out from facts the caller can't easily fake rather than trusted from a header: API keys are always 'api';
    otherwise the browser-set Origin says whether it's the web app or the Chrome extension. X-Source is only a fallback
    for signed-in callers without a recognised Origin (e.g. an extension content script), and only if it's valid, so a
    wrong value can never stop a run from being logged.
    """
    if getattr(g, 'api_key_user', None):
        return 'api'
    origin = request.headers.get('Origin', '')
    if origin.startswith('chrome-extension://'):
        return 'extension'
    if origin and origin in current_app.config.get('WEB_APP_ORIGINS', ()):
        return 'react-frontend'
    hinted = request.headers.get('X-Source', '')
    return hinted if hinted in SOURCE_TYPES else 'api'


def _run_source_and_user_id():
    """Source type and users.id to attribute a checker run to."""
    user_row = _current_users_row()
    user_id = str(user_row['id']) if user_row and user_row.get('id') else None
    return _run_source(), user_id


def _is_admin_request() -> bool:
    """Whether the signed-in user (Supabase JWT, after require_auth) is an admin."""
    jwt = getattr(g, 'supabase_jwt', None)
    if not jwt:
        return False
    return user_helpers.is_admin(email=jwt.get('email') or '', auth_user_id=jwt.get('sub'))


# Overview fields only admins see: who uses the checker, and crashed/rejected runs with their errors.
ADMIN_ONLY_OVERVIEW_FIELDS = ('users', 'problem_runs')


def require_admin(f):
    """Decorator that requires the user to be an admin (after require_auth)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'supabase_jwt') or not g.supabase_jwt:
            return api_error(401, 'unauthorized', 'Authentication required', details='Sign in to use admin features')
        if not _is_admin_request():
            return api_error(403, 'forbidden', 'Admin role required')
        return f(*args, **kwargs)
    return decorated_function


CHECKS_PER_HOUR = 50
ACCESS_REQUESTS_PER_HOUR_PER_IP = 5


def _rate_limited(message, code, retry_after=None):
    response = api_error(429, code, message)
    if retry_after:
        response.headers['Retry-After'] = str(retry_after)
    return response


def _client_ip():
    # On Fly the proxy sets Fly-Client-IP to the real client address; remote_addr is the proxy's.
    if os.getenv('FLY_APP_NAME'):
        return request.headers.get('Fly-Client-IP') or request.remote_addr
    return request.remote_addr


def limit_checks(f):
    """Per user: one check at a time, and at most CHECKS_PER_HOUR per rolling hour (use after require_auth).

    Limits cover browser and API-key calls together. If the limiter's own storage fails we log and let the
    request through, so a broken limiter can't take the checker down.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_row = _current_users_row()
        bucket = f"checks:user:{user_row['id']}" if user_row else f'checks:ip:{_client_ip()}'
        try:
            lock = rate_limit.acquire(bucket)
        except Exception:
            current_app.logger.exception('Rate limiter unavailable; allowing request')
            return f(*args, **kwargs)
        if lock is None:
            return _rate_limited(
                'You already have a check running. Wait for it to finish, then try again.',
                'check_in_progress',
            )
        try:
            try:
                allowed, retry_after = rate_limit.hit(bucket, CHECKS_PER_HOUR, 3600)
            except Exception:
                current_app.logger.exception('Rate limiter unavailable; allowing request')
                allowed, retry_after = True, 0
            if not allowed:
                minutes = max(1, round(retry_after / 60))
                return _rate_limited(
                    f'Limit of {CHECKS_PER_HOUR} checks per hour reached. Try again in about {minutes} min.',
                    'rate_limited',
                    retry_after,
                )
            return f(*args, **kwargs)
        finally:
            rate_limit.release(lock)

    return decorated_function


@main.route('/me', methods=['GET'])
@require_auth
def me():
    """Return current user and role from users table. 403 if not approved."""
    user_id = _current_user_id()
    if not user_id:
        return _auth_error('Valid Supabase JWT required')
    email = (_current_user_email() or '').strip().lower()
    if not email:
        return _auth_error('Email required')
    user_row = user_helpers.get_user_by_email(email)
    if not user_row:
        return jsonify({**error_body('access_denied', 'Access not authorized'), 'allowed': False}), 403
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
        return api_error(503, 'service_unavailable', 'Supabase not configured')
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
        return api_error(400, 'invalid_request', 'user_id required')
    data = request.get_json(silent=True) or {}
    new_role = data.get('role')
    if new_role not in ('user', 'admin'):
        return api_error(400, 'invalid_request', 'role must be "user" or "admin"')
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Supabase not configured')
    try:
        now = datetime.now(timezone.utc).isoformat()
        r = supabase.table('users').update({'role': new_role, 'updated_at': now}).eq('id', user_id).execute()
        if not r.data or len(r.data) == 0:
            return api_error(404, 'not_found', 'User not found')
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
        return api_error(400, 'invalid_request', 'user_id required')
    email = _current_user_email() or ''
    current_user_row = user_helpers.get_user_by_email(email)
    if current_user_row and str(current_user_row.get('id')) == str(user_id):
        return api_error(409, 'conflict', 'You can\'t remove your own account.')
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Supabase not configured')
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


def _current_admin_id():
    """users.id of the signed-in admin: what approved_by and decided_by record."""
    row = _current_users_row()
    return str(row['id']) if row and row.get('id') else None


def _is_unique_violation(error) -> bool:
    text = str(error).lower()
    return 'duplicate' in text or 'unique' in text or '23505' in text


def _access_request_response(row):
    return {
        'id': str(row['id']),
        'email': row['email'],
        'why_need_access': row.get('why_need_access'),
        'status': row['status'],
        'created_at': row.get('created_at'),
        'updated_at': row.get('updated_at'),
        'decided_by': str(row['decided_by']) if row.get('decided_by') else None,
    }


def _pending_request(supabase, email):
    r = (supabase.table('access_requests').select('*')
         .eq('status', 'pending').eq('email', email).limit(1).execute())
    return dict(r.data[0]) if r.data else None


def _record_access_request(supabase, email, why):
    """Record a request for access, once. Returns (status, row, created).

    An email that already has access gets ('approved', None, False); one with a pending request gets that request.
    A unique index (migration 010) backs this up when two requests race.
    """
    if user_helpers.get_user_by_email(email):
        return 'approved', None, False
    existing = _pending_request(supabase, email)
    if existing:
        return 'pending', existing, False
    try:
        r = supabase.table('access_requests').insert(
            {'email': email, 'status': 'pending', 'why_need_access': why}).execute()
    except Exception as e:
        if not _is_unique_violation(e):
            raise
        return 'pending', _pending_request(supabase, email), False
    if not r.data:
        raise RuntimeError('access_requests insert returned no row')
    return 'pending', dict(r.data[0]), True


@main.route('/access-requests', methods=['POST'])
def post_access_request():
    """Ask for access. Signed in (Supabase JWT): the email comes from the token. Otherwise the body is
    {"email", "why_need_access"}.

    One pending request per email: asking again, or for an email that already has access, changes nothing.
    Anonymous callers always get the same 202 answer, so the endpoint can't be used to find out who has access.
    """
    # Unauthenticated endpoint: cap per client IP so the request list can't be flooded.
    # Fails closed: without the limiter anyone could flood the list, so refuse until it's back.
    try:
        allowed, retry_after = rate_limit.hit(
            f'access-requests:ip:{_client_ip()}', ACCESS_REQUESTS_PER_HOUR_PER_IP, 3600
        )
    except Exception:
        current_app.logger.exception('Rate limiter unavailable; refusing access request')
        response = api_error(
            503, 'service_unavailable', "We couldn't take your request right now. Please try again in a minute.")
        response.headers['Retry-After'] = '60'
        return response
    if not allowed:
        return _rate_limited('Too many access requests. Please try again later.', 'rate_limited', retry_after)
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Service unavailable')

    auth_header = request.headers.get('Authorization', '')
    token = (auth_header[7:] if auth_header.startswith('Bearer ') else auth_header).strip()
    payload = verify_supabase_token(token) if token else None
    body = request.get_json(silent=True) or {}

    if payload:
        email = (payload.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return api_error(400, 'invalid_request', 'Invalid email in token')
        why = (body.get('why_need_access') or '').strip() or None
    else:
        if not request.is_json:
            return api_error(
                400, 'invalid_request', 'Send JSON with email and why_need_access, or sign in first.')
        email, err = _validate_email(body.get('email'))
        if err:
            return api_error(400, 'invalid_request', err)
        why = (body.get('why_need_access') or '').strip()
        if not why:
            return api_error(400, 'invalid_request', 'Please tell us why you need access.')

    try:
        status, row, created = _record_access_request(supabase, email, why)
    except Exception:
        return _internal_error()

    if not payload:
        return jsonify({'email': email, 'status': 'received'}), 202
    # Signed in: it's their own request, so they can see where it stands.
    response = {'email': email, 'status': status}
    if row:
        response['id'] = str(row['id'])
    return jsonify(response), 201 if created else 200


@main.route('/admin/access-requests', methods=['GET'])
@require_auth
@require_admin
def admin_list_access_requests():
    """List access requests (admin only). Default: pending only. ?status=all for all."""
    status_filter = request.args.get('status', 'pending')
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Supabase not configured')
    try:
        q = supabase.table('access_requests').select(
            'id, email, why_need_access, status, created_at, updated_at, decided_by').order('created_at', desc=True)
        if status_filter != 'all':
            q = q.eq('status', status_filter)
        rows = q.execute().data or []
        return jsonify([_access_request_response(x) for x in rows]), 200
    except Exception:
        return _internal_error()


@main.route('/admin/access-requests/<request_id>', methods=['PATCH'])
@require_auth
@require_admin
def admin_update_access_request(request_id):
    """Approve or reject an access request (admin only). Body: { "status": "approved" | "rejected" }."""
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in ('approved', 'rejected'):
        return api_error(400, 'invalid_request', 'status must be "approved" or "rejected"')
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Supabase not configured')
    admin_id = _current_admin_id()
    try:
        r = supabase.table('access_requests').select('*').eq('id', request_id).limit(1).execute()
        if not r.data:
            return api_error(404, 'not_found', 'Request not found')
        req = dict(r.data[0])
        # Allow approving pending or rejected; allow rejecting only pending
        if new_status == 'approved' and req['status'] == 'approved':
            return api_error(409, 'conflict', 'This request is already approved.')
        if new_status == 'rejected' and req['status'] != 'pending':
            return api_error(409, 'conflict', 'Only pending requests can be rejected.')
        if new_status == 'approved':
            email = (req.get('email') or '').strip().lower()
            if not email:
                return api_error(400, 'invalid_request', 'Invalid request email')
            user_insert = {'email': email, 'role': 'user', 'added_via': 'access_request'}
            if admin_id:
                user_insert['approved_by'] = admin_id
            try:
                supabase.table('users').insert(user_insert).execute()
            except Exception as insert_err:
                if not _is_unique_violation(insert_err):
                    return _internal_error('Failed to create user for this request.')
        supabase.table('access_requests').update({
            'status': new_status,
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'decided_by': admin_id,
        }).eq('id', request_id).execute()
        r2 = supabase.table('access_requests').select('*').eq('id', request_id).limit(1).execute()
        return jsonify(_access_request_response(dict(r2.data[0]) if r2.data else req)), 200
    except Exception:
        return _internal_error()


@main.route('/admin/invites', methods=['POST'])
@require_auth
@require_admin
def admin_invite():
    """Invite a user by email (admin only). Body: { "email": "..." }. Approves any pending request for that email."""
    if not request.is_json:
        return api_error(400, 'invalid_request', 'Request must be JSON with email field')
    data = request.get_json() or {}
    email, err = _validate_email(data.get('email'))
    if err:
        return api_error(400, 'invalid_request', err)
    supabase = get_supabase_client()
    if not supabase:
        return api_error(503, 'service_unavailable', 'Supabase not configured')
    admin_id = _current_admin_id()
    user_insert = {'email': email, 'role': 'user', 'added_via': 'invite'}
    if admin_id:
        user_insert['approved_by'] = admin_id
    try:
        r = supabase.table('users').insert(user_insert).execute()
        if not r.data:
            return api_error(500, 'internal_error', 'Failed to create invite')
        row = dict(r.data[0])
    except Exception as e:
        if _is_unique_violation(e):
            return api_error(409, 'conflict', 'User already invited or approved')
        return _internal_error()
    try:
        # They're in now, so a request they left waiting is answered too.
        supabase.table('access_requests').update({
            'status': 'approved',
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'decided_by': admin_id,
        }).eq('status', 'pending').eq('email', email).execute()
    except Exception:
        current_app.logger.exception('Invited %s but could not close their pending access request', email)
    return jsonify({
        'id': str(row['id']),
        'email': row['email'],
        'role': row.get('role', 'user'),
        'added_via': row.get('added_via'),
        'created_at': row.get('created_at'),
    }), 201


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
        return api_error(403, 'access_denied', 'Access not authorized')
    try:
        return jsonify([_api_key_response(row) for row in api_keys.list_keys(str(user_row['id']))]), 200
    except Exception:
        return _internal_error()


@main.route('/api-keys', methods=['POST'])
@require_auth
def create_my_api_key():
    """Create an API key for the caller. Body: {"name": "...", "expires_in_days": 90}. The key is returned once.
    Admins can pass "expires_in_days": null for a key that never expires."""
    user_row = _current_users_row()
    if not user_row:
        return api_error(403, 'access_denied', 'Access not authorized')
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    if not isinstance(name, str) or not name.strip():
        return api_error(400, 'invalid_request', 'name is required')
    name = name.strip()
    if len(name) > 100:
        return api_error(400, 'invalid_request', 'name must be 100 characters or fewer')
    expires_in_days = data.get('expires_in_days', api_keys.DEFAULT_EXPIRY_DAYS)
    if expires_in_days is None:
        if not _is_admin_request():
            return api_error(400, 'invalid_request', 'Only admins can create keys that never expire')
    elif not isinstance(expires_in_days, int) or isinstance(expires_in_days, bool) \
            or not 1 <= expires_in_days <= api_keys.MAX_EXPIRY_DAYS:
        return api_error(
            400, 'invalid_request', f'expires_in_days must be a whole number from 1 to {api_keys.MAX_EXPIRY_DAYS}')
    try:
        user_id = str(user_row['id'])
        if api_keys.count_active_keys(user_id) >= api_keys.MAX_ACTIVE_KEYS_PER_USER:
            return api_error(
                409, 'conflict', f'You can have at most {api_keys.MAX_ACTIVE_KEYS_PER_USER} active keys. Revoke one first.')
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
        return api_error(403, 'access_denied', 'Access not authorized')
    try:
        row = api_keys.get_key(key_id)
        # Same 404 for "not found" and "not yours" so key ids cannot be probed.
        if not row or str(row.get('user_id')) != str(user_row['id']):
            return api_error(404, 'not_found', 'API key not found')
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
            return api_error(404, 'not_found', 'API key not found')
        api_keys.revoke_key(key_id)
    except Exception:
        return _internal_error()
    return '', 204


def _comment_response(row, include_author=False):
    """A summary comment for the client. Authors are only shown to admins."""
    out = {
        'id': str(row['id']),
        'review_id': str(row['review_id']),
        'section_key': row.get('section_key'),
        'section_title': row.get('section_title'),
        'quote': row.get('quote'),
        'quote_start': row.get('quote_start'),
        'quote_end': row.get('quote_end'),
        'body': row.get('body'),
        'created_at': row.get('created_at'),
        'resolved_at': row.get('resolved_at'),
        'template_name': row.get('template_name'),
        'summary': row.get('summary'),
        'reviewed_at': row.get('reviewed_at'),
    }
    if include_author:
        out.update(user_id=str(row['user_id']), user_email=row.get('user_email'),
                   user_display_name=row.get('user_display_name'))
    return out


@main.route('/summary-reviews', methods=['POST'])
@require_auth
def create_summary_review():
    """Record that the caller reviewed a customer summary before copying it, with any comments they left.

    Body: {"template_name", "summary", "comments": [{"section_key", "section_title"?, "body",
    "quote"?, "quote_start"?, "quote_end"?}]}. No comments means "reviewed, no feedback".
    """
    user_row = _current_users_row()
    if not user_row:
        return api_error(403, 'access_denied', 'Access not authorized')
    review_input, error = summary_feedback.validate_review(request.get_json(silent=True))
    if error:
        return api_error(400, 'invalid_request', error)
    template_name, summary, comments = review_input
    try:
        review = summary_feedback.create_review(str(user_row['id']), template_name, summary, comments)
    except Exception:
        return _internal_error("Couldn't save your feedback. Please try again.")
    return jsonify({
        'id': str(review['id']),
        'outcome': review['outcome'],
        'created_at': review.get('created_at'),
        'comments': [_comment_response({**c, 'template_name': template_name}) for c in review['comments']],
    }), 201


@main.route('/summary-reviews/mine', methods=['GET'])
@require_auth
def list_my_summary_feedback():
    """The caller's own summary comments, newest first (never anyone else's)."""
    user_row = _current_users_row()
    if not user_row:
        return api_error(403, 'access_denied', 'Access not authorized')
    try:
        rows = summary_feedback.list_user_comments(str(user_row['id']))
    except Exception:
        return _internal_error()
    return jsonify([_comment_response(row) for row in rows]), 200


@main.route('/admin/summary-feedback', methods=['GET'])
@require_auth
@require_admin
def admin_list_summary_feedback():
    """Every summary comment with its author, plus review counts (admin only). ?status=open|resolved|all."""
    status = request.args.get('status', 'open')
    if status not in summary_feedback.STATUSES:
        return api_error(400, 'invalid_request', 'status must be one of: open, resolved, all')
    try:
        data = summary_feedback.list_feedback(status)
    except Exception:
        return _internal_error()
    return jsonify({
        'stats': data['stats'],
        'comments': [_comment_response(row, include_author=True) for row in data['comments']],
    }), 200


@main.route('/admin/summary-feedback/<comment_id>', methods=['PATCH'])
@require_auth
@require_admin
def admin_resolve_summary_comment(comment_id):
    """Mark a summary comment resolved or open again (admin only). Body: {"resolved": true|false}."""
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get('resolved'), bool):
        return api_error(400, 'invalid_request', 'resolved must be true or false')
    admin_row = _current_users_row()
    try:
        row = summary_feedback.set_resolved(comment_id, data['resolved'], str(admin_row['id']) if admin_row else None)
    except Exception:
        return _internal_error()
    if not row:
        return api_error(404, 'not_found', 'Comment not found')
    return jsonify(_comment_response(row)), 200


@main.route('/health')
@main.route('/test')  # old name, kept for anything still calling it
def health():
    """Liveness check: no auth, no database. Also handy to wake the machine before a demo."""
    return jsonify({'status': 'ok', 'version': get_app_version()})


# Paths from before /v1, kept working. Responses on them say they're deprecated and where they moved
# (Deprecation, RFC 9745: deprecated since 2026-10-12; Link rel="successor-version").
LEGACY_PATHS = {
    '/run': '/v1/checks',
    '/summary': '/v1/checks/summary',
    '/run-and-download-xml': '/v1/checks/xml',
    '/test': '/health',
}
_DEPRECATED_SINCE = '@1791763200'  # 2026-10-12T00:00:00Z


@main.after_request
def mark_legacy_paths(response):
    successor = LEGACY_PATHS.get(request.path)
    if successor:
        response.headers['Deprecation'] = _DEPRECATED_SINCE
        response.headers['Link'] = f'<{successor}>; rel="successor-version"'
    return response


def _require_upload(zip_only=False):
    """Reject a missing (or, with zip_only, non-.zip) upload before the rate limiter, so it doesn't use up a check."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            upload = request.files.get('file')
            if upload is None or not upload.filename:
                return api_error(400, 'missing_file', 'Attach the packaged template as a .zip file in the "file" field.')
            if zip_only and not upload.filename.lower().endswith('.zip'):
                return api_error(
                    400, 'unsupported_file_type', 'Upload the packaged template as a .zip file (InDesign: File > Package).')
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def _not_checkable(outcome):
    """422 for an upload the checker rejected, with its reason. Rejection reasons are written by the checker for
    users: not a valid ZIP, no .idml file, too many files..."""
    reason = first_error_message(outcome.results)
    message = f'The file couldn\'t be checked: {reason}' if reason else 'The file couldn\'t be checked.'
    return api_error(422, 'template_not_checkable', message)


def _run_and_respond(respond, previews: bool = False):
    """Store the upload, run the check, and build the response from its outcome. Everything the run writes
    (upload, unpacked package, XML export) is in one run folder, removed either way."""
    with run_workspace() as workspace:
        g.workspace = workspace
        source_type, run_user_id = _run_source_and_user_id()
        upload_result = upload_file()
        if upload_result['status'] != 'success':
            return api_error(500, 'upload_failed', 'The upload couldn\'t be saved. Try again.')
        try:
            # Page previews are most of a run's time; only rendered when shown (plan D6).
            outcome = run_check(upload_result['path'], workspace, source_type, user_id=run_user_id, previews=previews)
        except CheckFailed as failed:
            g.run_id = failed.run_id
            return api_error(
                500, 'check_failed', 'The template couldn\'t be checked. Try again, or contact us with the request ID.')
        g.run_id = outcome.run_id
        return respond(outcome, workspace)


@main.route('/v1/checks', methods=['POST'])
@require_auth(allow_api_key=True)
@_require_upload()
@limit_checks
def create_check():
    """Check an uploaded template package and return every result.

    Response 200: {run_id, status: "completed" | "rejected", results, customer_summary}: results v2
    (schema/results-v2.json) and the customer summary (null if it couldn't be written). A package that couldn't be
    checked (not a valid ZIP, no .idml...) is "rejected", with the reason in the results.
    """
    return _run_and_respond(lambda outcome, _: jsonify({
        'run_id': outcome.run_id,
        'status': 'completed' if outcome.completed else 'rejected',
        **outcome.response(),
    }), previews=request.args.get('previews') == '1')


@main.route('/run', methods=['POST'])
@require_auth(allow_api_key=True)
@_require_upload()
@limit_checks
def run_checker():
    """Deprecated: POST /v1/checks. Same check, wrapped as {type: "data", content: {results, customer_summary}}."""
    return _run_and_respond(
        lambda outcome, _: jsonify({'type': 'data', 'content': outcome.response()}), previews=True)


@main.route('/v1/checks/summary', methods=['POST'])
@main.route('/summary', methods=['POST'])
@require_auth(allow_api_key=True)
@_require_upload(zip_only=True)
@limit_checks
def customer_summary():
    """Check an uploaded template package and return the customer summary, ready to review and paste into Intercom.

    Request: multipart/form-data with the packaged template as a .zip in the `file` field.
    Response 200: {run_id, template_name, summary_version, counts: {blockers, warnings, infos}, html, text}.
    `html` pastes with formatting into Intercom; `text` is the same message as plain text with links written out.
    Errors: {error: {code, message, request_id}}; see docs/API.md for the codes.
    Counts toward the same per-user check limits as /run.
    """
    filename = request.files['file'].filename

    def respond(outcome, _):
        if not outcome.completed:
            return _not_checkable(outcome)
        if outcome.summary is None:
            return api_error(
                500, 'summary_failed', 'The summary couldn\'t be written. Try again, or contact us with the request ID.')
        response = jsonify({
            'run_id': outcome.run_id,
            'template_name': display_template_name(outcome.results.get('template_name') or filename),
            **summary_payload(outcome.summary, include_sections=False),
        })
        # The summary names the customer's template and content: don't let proxies or browsers keep a copy.
        response.headers['Cache-Control'] = 'no-store'
        return response

    return _run_and_respond(respond)


_EXPORT_FAILED = 'The XML export couldn\'t be created. Try again, or contact us with the request ID.'


@main.route('/v1/checks/xml', methods=['POST'])
@main.route('/run-and-download-xml', methods=['POST'])
@require_auth(allow_api_key=True)
@_require_upload()
@limit_checks
def run_checker_and_download():
    """Check an uploaded template package and download its generated XML as a ZIP."""
    def respond(outcome, workspace):
        if not outcome.completed:
            return _not_checkable(outcome)
        zip_path = zip_idml(outcome.idml_folder, workspace)
        if not zip_path or not os.path.isfile(zip_path):
            current_app.logger.error('XML export ZIP missing: %s', zip_path)
            return api_error(500, 'export_failed', _EXPORT_FAILED)

        try:
            # send_file opens the zip now, so it's still sent after _run_and_respond removes the run folder.
            return send_file(zip_path, mimetype='application/zip', as_attachment=True,
                             download_name=f'{display_template_name(outcome.results.get("template_name") or "template")}-xml.zip')
        except Exception:
            current_app.logger.exception('Failed to send the XML export')
            return api_error(500, 'export_failed', _EXPORT_FAILED)

    return _run_and_respond(respond)


def _analytics_period():
    """The period the request asks for: ?days=N, or ?start=YYYY-MM-DD&end=YYYY-MM-DD; plus ?tz=."""
    args = request.args
    return analytics_period(days=args.get('days', 30), tz=args.get('tz'), start=args.get('start'), end=args.get('end'))


def _run_filters():
    args = request.args
    return run_filters(
        status=args.get('status'),
        source=args.get('source'),
        user_id=args.get('user_id'),
        search=args.get('q'),
        validation_type=args.get('validation_type'),
    )


def _bad_analytics_request(error):
    """400 for invalid analytics parameters. The specific reason is logged, not echoed back: exception text
    never goes into a response (CodeQL py/stack-trace-exposure), and our own frontend validates first anyway."""
    current_app.logger.info('Rejected analytics request: %s', error)
    return api_error(400, 'invalid_request', 'Invalid analytics request. Check the date range and filters.')


def _analytics_response(load):
    """Run an analytics query: 400 for bad parameters, 500 (logged, generic message) for anything else."""
    try:
        data = load()
    except AnalyticsQueryError as e:
        return _bad_analytics_request(e)
    except Exception:
        return _internal_error('Failed to load analytics')
    if isinstance(data, dict) and 'error' in data:
        current_app.logger.error('Analytics unavailable: %s', data['error'])
        return api_error(500, 'internal_error', 'Failed to load analytics')
    return jsonify(data), 200


@main.route('/analytics/overview', methods=['GET'])
@require_auth
def analytics_overview():
    """Everything the analytics page shows for the requested period, vs. the period before.

    Non-admins get the aggregate numbers and findings, but not who's using it or which runs crashed.
    """
    def load():
        overview = get_overview(_analytics_period())
        if isinstance(overview, dict) and 'error' not in overview and not _is_admin_request():
            for field in ADMIN_ONLY_OVERVIEW_FIELDS:
                if field in overview:
                    overview[field] = []
        return overview
    return _analytics_response(load)


@main.route('/analytics/issues/<validation_type>', methods=['GET'])
@require_auth
def analytics_issue_detail(validation_type):
    """Drill-down for one issue type: trend and the identifiers it hit most."""
    return _analytics_response(lambda: get_issue_detail(validation_type, _analytics_period()))


@main.route('/analytics/api', methods=['GET'])
@require_auth
@require_admin
def analytics_api_usage():
    """How the API is used in the requested period (admin only): requests by key, endpoint and error."""
    return _analytics_response(lambda: get_api_usage(_analytics_period()))


@main.route('/analytics/runs', methods=['GET'])
@require_auth
@require_admin
def analytics_runs():
    """One page of runs, newest first (admin only). Filters: status, source, user_id, q (template name), validation_type."""
    return _analytics_response(lambda: get_runs(
        _analytics_period(),
        _run_filters(),
        limit=request.args.get('limit', 25),
        offset=request.args.get('offset', 0),
    ))


@main.route('/analytics/runs.csv', methods=['GET'])
@require_auth
@require_admin
def analytics_runs_csv():
    """The runs matching the same filters as /analytics/runs, as a CSV download (admin only, up to MAX_EXPORT_ROWS)."""
    try:
        export = export_runs_csv(_analytics_period(), _run_filters())
    except AnalyticsQueryError as e:
        return _bad_analytics_request(e)
    except Exception:
        return _internal_error('Failed to export analytics')
    if 'error' in export:
        current_app.logger.error('Analytics unavailable: %s', export['error'])
        return api_error(500, 'internal_error', 'Failed to export analytics')
    filename = f"template-checks-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
    return Response(
        export['csv'],
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'X-Total-Rows': str(export['total']),
            'X-Exported-Rows': str(export['exported']),
            'Cache-Control': 'no-store',
        },
    )
