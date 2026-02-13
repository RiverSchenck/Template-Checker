"""Profile and role helpers using Supabase profiles table."""
import os
from datetime import datetime, timezone
from typing import Any, Optional

from .analytics_api import get_supabase_client


def get_allowed_admin_emails() -> set[str]:
    raw = os.getenv('ALLOWED_ADMIN_EMAILS', '')
    return {e.strip().lower() for e in raw.split(',') if e.strip()}


def _allowed_admin_emails() -> set[str]:
    return get_allowed_admin_emails()


def get_profile(user_id: str) -> Optional[dict[str, Any]]:
    """Get profile row by user id. Returns None if not found."""
    supabase = get_supabase_client()
    if not supabase:
        return None
    try:
        r = supabase.table('profiles').select('*').eq('id', user_id).limit(1).execute()
        if r.data and len(r.data) > 0:
            return dict(r.data[0])
    except Exception:
        pass
    return None


def upsert_profile(
    user_id: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
    role: str = 'user',
) -> Optional[dict[str, Any]]:
    """Insert or update profile. Returns the profile row or None."""
    supabase = get_supabase_client()
    if not supabase:
        return None
    try:
        row = {
            'id': user_id,
            'email': email or '',
            'display_name': display_name or '',
            'role': role if role in ('user', 'admin') else 'user',
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }
        # Supabase upsert: on conflict update
        r = supabase.table('profiles').upsert(row, on_conflict='id').execute()
        if r.data and len(r.data) > 0:
            return dict(r.data[0])
    except Exception:
        pass
    return None


def is_admin(user_id: str, email: Optional[str] = None) -> bool:
    """True if user is admin (profile.role or ALLOWED_ADMIN_EMAILS)."""
    allowed = _allowed_admin_emails()
    if email and email.lower() in allowed:
        return True
    profile = get_profile(user_id)
    if profile and profile.get('role') == 'admin':
        return True
    return False


def ensure_profile_and_get_role(
    user_id: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
) -> str:
    """
    Get profile for user; if none exists, create one (admin if email in ALLOWED_ADMIN_EMAILS else user).
    Returns role.
    """
    profile = get_profile(user_id)
    if profile:
        return profile.get('role', 'user')
    role = 'admin' if (email and email.lower() in _allowed_admin_emails()) else 'user'
    upsert_profile(user_id, email=email, display_name=display_name, role=role)
    return role
