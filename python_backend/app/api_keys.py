"""Per-user API keys for calling the checker outside the web app (api_keys table).

Keys look like `tc_<43 url-safe chars>`. Only a SHA-256 hash is stored; the plaintext is returned once at creation.
Keys are long and random, so a plain (unsalted) hash is enough and allows an indexed lookup.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .analytics_api import get_supabase_client, parse_timestamp

KEY_PREFIX = 'tc_'
DISPLAY_PREFIX_LEN = 10
DEFAULT_EXPIRY_DAYS = 90
MAX_EXPIRY_DAYS = 365
MAX_ACTIVE_KEYS_PER_USER = 10

# Columns safe to return to clients (never key_hash).
PUBLIC_COLUMNS = 'id, user_id, name, key_prefix, created_at, expires_at, last_used_at, revoked_at'


def looks_like_api_key(token: str) -> bool:
    return bool(token) and token.startswith(KEY_PREFIX)


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode('utf-8')).hexdigest()


def _is_expired(row: dict[str, Any], now: datetime) -> bool:
    expires_at = row.get('expires_at')
    if not expires_at:
        return False
    try:
        return parse_timestamp(expires_at) <= now
    except ValueError:
        return True


def is_active(row: dict[str, Any], now: Optional[datetime] = None) -> bool:
    return not row.get('revoked_at') and not _is_expired(row, now or datetime.now(timezone.utc))


def create_key(user_id: str, name: str, expires_in_days: int) -> tuple[str, dict[str, Any]]:
    """Create a key for users.id `user_id`. Returns (plaintext_key, public row). Raises on Supabase errors."""
    key = KEY_PREFIX + secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    row = {
        'user_id': user_id,
        'name': name,
        'key_hash': _hash(key),
        'key_prefix': key[:DISPLAY_PREFIX_LEN],
        'expires_at': expires_at.isoformat(),
    }
    r = get_supabase_client().table('api_keys').insert(row).execute()
    created = dict(r.data[0])
    created.pop('key_hash', None)
    return key, created


def list_keys(user_id: Optional[str] = None) -> list[dict[str, Any]]:
    """List keys (newest first), for one user or all users. Never includes key_hash."""
    q = get_supabase_client().table('api_keys').select(PUBLIC_COLUMNS)
    if user_id:
        q = q.eq('user_id', user_id)
    r = q.order('created_at', desc=True).execute()
    return [dict(row) for row in (r.data or [])]


def count_active_keys(user_id: str) -> int:
    now = datetime.now(timezone.utc)
    return sum(1 for row in list_keys(user_id) if is_active(row, now))


def get_key(key_id: str) -> Optional[dict[str, Any]]:
    try:
        uuid.UUID(key_id)
    except ValueError:
        return None  # Not a UUID; querying would make Postgres raise.
    r = get_supabase_client().table('api_keys').select(PUBLIC_COLUMNS).eq('id', key_id).limit(1).execute()
    return dict(r.data[0]) if r.data else None


def revoke_key(key_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    (
        get_supabase_client().table('api_keys')
        .update({'revoked_at': now})
        .eq('id', key_id)
        .is_('revoked_at', 'null')
        .execute()
    )


def resolve_key(key: str) -> Optional[dict[str, Any]]:
    """Return the owning users row for a valid, unrevoked, unexpired key; otherwise None. Updates last_used_at."""
    if not looks_like_api_key(key):
        return None
    supabase = get_supabase_client()
    if not supabase:
        return None
    try:
        r = (
            supabase.table('api_keys')
            .select('id, user_id, expires_at, revoked_at, users(*)')
            .eq('key_hash', _hash(key))
            .limit(1)
            .execute()
        )
        if not r.data:
            return None
        row = dict(r.data[0])
        now = datetime.now(timezone.utc)
        user = row.get('users')
        if not is_active(row, now) or not user:
            return None
        supabase.table('api_keys').update({'last_used_at': now.isoformat()}).eq('id', row['id']).execute()
        return dict(user)
    except Exception:
        return None
