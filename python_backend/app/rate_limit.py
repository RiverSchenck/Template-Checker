"""Rate limiting and per-user "one check at a time", shared by every backend machine and worker.

State lives in Supabase (migrations/006_rate_limits.sql): `rate_limit_hit` is an atomic sliding-window counter and
`acquire_check_lease` / `release_check_lease` hand out one lease per bucket. Leases expire on their own, so a worker
that is killed mid-check can't lock a user out for longer than LEASE_TTL_SECONDS.

hit() and acquire() raise LimiterUnavailable (or a Supabase error) when the limiter can't be reached; callers decide
whether to fail open.
"""
import logging
from typing import Any, Optional

from .analytics_api import get_supabase_client

logger = logging.getLogger(__name__)

# Longer than the longest possible request (gunicorn --timeout 600), so a lease outlives any check that holds it.
LEASE_TTL_SECONDS = 660


class LimiterUnavailable(Exception):
    pass


def _rpc(name: str, params: dict[str, Any]) -> Any:
    supabase = get_supabase_client()
    if not supabase:
        raise LimiterUnavailable('Supabase not configured')
    return supabase.rpc(name, params).execute().data


def hit(bucket: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Record one hit for `bucket` if under `limit` in the sliding window.

    Returns (allowed, retry_after_seconds). A rejected attempt is not recorded, so it doesn't extend the wait.
    """
    data = _rpc('rate_limit_hit', {'p_bucket': bucket, 'p_limit': limit, 'p_window_seconds': window_seconds})
    row = data[0] if isinstance(data, list) and data else data
    if not isinstance(row, dict):
        raise LimiterUnavailable('rate_limit_hit returned no row')
    return bool(row['allowed']), int(row.get('retry_after_seconds') or 0)


def acquire(bucket: str) -> Optional[tuple[str, str]]:
    """Take the lease for `bucket`. Returns a handle for release(), or None if another request holds it."""
    lease_id = _rpc('acquire_check_lease', {'p_bucket': bucket, 'p_ttl_seconds': LEASE_TTL_SECONDS})
    return (bucket, str(lease_id)) if lease_id else None


def release(handle: tuple[str, str]) -> None:
    """Release a lease. Never raises: if this fails the lease simply expires after LEASE_TTL_SECONDS."""
    bucket, lease_id = handle
    try:
        _rpc('release_check_lease', {'p_bucket': bucket, 'p_lease_id': lease_id})
    except Exception:
        logger.exception('Failed to release check lease for %s; it will expire on its own', bucket)
