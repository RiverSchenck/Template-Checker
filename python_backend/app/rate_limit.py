"""Rate limiting and per-user concurrency guard, shared by all gunicorn workers on the machine.

State lives in a small directory (SQLite for sliding-window counts, flock files for "one check at a time"), so the
limits hold across workers. It is per machine: with more than one Fly machine each one counts separately, and state
resets when the machine restarts. Move to Redis if the app is ever scaled out.
"""
import fcntl
import hashlib
import os
import sqlite3
import time
from typing import Optional

STATE_DIR = os.getenv('RATE_LIMIT_DIR', '/tmp/template-checker-rate-limit')


def _db() -> sqlite3.Connection:
    os.makedirs(STATE_DIR, exist_ok=True)
    conn = sqlite3.connect(os.path.join(STATE_DIR, 'hits.sqlite3'), timeout=5, isolation_level=None)
    conn.execute('CREATE TABLE IF NOT EXISTS hits (bucket TEXT NOT NULL, ts REAL NOT NULL)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_hits_bucket_ts ON hits(bucket, ts)')
    return conn


def hit(bucket: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Record one hit for `bucket` if under `limit` in the sliding window.

    Returns (allowed, retry_after_seconds). A rejected attempt is not recorded, so it doesn't extend the wait.
    """
    now = time.time()
    conn = _db()
    try:
        conn.execute('BEGIN IMMEDIATE')  # serialize check-and-insert across workers
        conn.execute('DELETE FROM hits WHERE bucket = ? AND ts <= ?', (bucket, now - window_seconds))
        count, oldest = conn.execute('SELECT COUNT(*), MIN(ts) FROM hits WHERE bucket = ?', (bucket,)).fetchone()
        if count >= limit:
            conn.execute('COMMIT')
            return False, max(1, int(oldest + window_seconds - now) + 1)
        conn.execute('INSERT INTO hits (bucket, ts) VALUES (?, ?)', (bucket, now))
        conn.execute('COMMIT')
        return True, 0
    finally:
        conn.close()


def acquire(bucket: str) -> Optional[int]:
    """Take an exclusive, non-blocking lock for `bucket`. Returns a handle for release(), or None if already held.

    The OS releases the lock if the worker dies, so a crash can't leave a user locked out.
    """
    os.makedirs(STATE_DIR, exist_ok=True)
    name = hashlib.sha256(bucket.encode('utf-8')).hexdigest()[:32]
    fd = os.open(os.path.join(STATE_DIR, f'{name}.lock'), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return None
    return fd


def release(handle: int) -> None:
    try:
        fcntl.flock(handle, fcntl.LOCK_UN)
    finally:
        os.close(handle)
