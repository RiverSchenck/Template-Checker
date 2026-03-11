"""User and role helpers using Supabase users table (approved users + role)."""
from datetime import datetime, timezone
from typing import Any, Optional

from .analytics_api import get_supabase_client


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    """Get users row by email (case-insensitive). Returns None if not found."""
    if not email or not email.strip():
        return None
    supabase = get_supabase_client()
    if not supabase:
        return None
    try:
        r = (
            supabase.table('users')
            .select('*')
            .eq('email', email.strip().lower())
            .limit(1)
            .execute()
        )
        if r.data and len(r.data) > 0:
            return dict(r.data[0])
    except Exception:
        pass
    return None


def get_user_by_auth_id(auth_user_id: str) -> Optional[dict[str, Any]]:
    """Get users row by auth_user_id. Returns None if not found."""
    if not auth_user_id:
        return None
    supabase = get_supabase_client()
    if not supabase:
        return None
    try:
        r = (
            supabase.table('users')
            .select('*')
            .eq('auth_user_id', auth_user_id)
            .limit(1)
            .execute()
        )
        if r.data and len(r.data) > 0:
            return dict(r.data[0])
    except Exception:
        pass
    return None


def is_user_allowed(email: str) -> bool:
    """True if there is a users row for this email (approved to sign in)."""
    return get_user_by_email(email) is not None


def is_admin(email: Optional[str] = None, auth_user_id: Optional[str] = None) -> bool:
    """True if user has role admin. Look up by email or auth_user_id."""
    row = None
    if auth_user_id:
        row = get_user_by_auth_id(auth_user_id)
    if not row and email:
        row = get_user_by_email(email)
    return row is not None and row.get('role') == 'admin'


def upsert_user_on_signin(
    auth_user_id: str,
    email: str,
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    Find users row by email; if found, update auth_user_id (if null), display_name, avatar_url.
    Does not create rows (only invite/approve create rows). Returns updated row or None.
    """
    row = get_user_by_email(email)
    if not row:
        return None
    supabase = get_supabase_client()
    if not supabase:
        return None
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        'updated_at': now,
        'last_seen_at': now,
        'display_name': display_name if display_name is not None else row.get('display_name'),
        'avatar_url': avatar_url if avatar_url is not None else row.get('avatar_url'),
    }
    if row.get('auth_user_id') is None:
        updates['auth_user_id'] = auth_user_id
    try:
        r = (
            supabase.table('users')
            .update(updates)
            .eq('id', row['id'])
            .execute()
        )
        if r.data and len(r.data) > 0:
            return dict(r.data[0])
        return {**row, **updates}
    except Exception:
        return None
