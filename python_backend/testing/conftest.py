import math
import os
import shutil
import uuid

import pytest

DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'data')


@pytest.fixture(scope='session', autouse=True)
def cleanup_unzipped_test_data():
    """Remove the folders FrontifyChecker unzips into src/data during the test run (they can add up to GBs)."""
    before = set(os.listdir(DATA_FOLDER)) if os.path.isdir(DATA_FOLDER) else set()
    yield
    if not os.path.isdir(DATA_FOLDER):
        return
    for name in set(os.listdir(DATA_FOLDER)) - before:
        path = os.path.join(DATA_FOLDER, name)
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)


class FakeLimiterDB:
    """In-memory stand-in for the Supabase functions in migrations/006_rate_limits.sql (same semantics).

    The SQL itself is exercised against a real Postgres separately; this keeps unit tests offline.
    """

    def __init__(self):
        self.now = 1_000_000.0
        self.hits = {}    # bucket -> [timestamps]
        self.leases = {}  # bucket -> (lease_id, expires_at)
        self.calls = []

    def rpc(self, name, params):
        self.calls.append(name)
        bucket = params['p_bucket']
        if name == 'rate_limit_hit':
            window = params['p_window_seconds']
            hits = [t for t in self.hits.get(bucket, []) if t > self.now - window]
            if len(hits) >= params['p_limit']:
                self.hits[bucket] = hits
                return [{'allowed': False, 'retry_after_seconds': max(1, math.ceil(min(hits) + window - self.now))}]
            self.hits[bucket] = hits + [self.now]
            return [{'allowed': True, 'retry_after_seconds': 0}]
        if name == 'acquire_check_lease':
            held = self.leases.get(bucket)
            if held and held[1] > self.now:
                return None
            lease_id = str(uuid.uuid4())
            self.leases[bucket] = (lease_id, self.now + params['p_ttl_seconds'])
            return lease_id
        if name == 'release_check_lease':
            if self.leases.get(bucket, (None,))[0] == params['p_lease_id']:
                del self.leases[bucket]
            return None
        raise AssertionError(f'unexpected rpc {name}')


@pytest.fixture(autouse=True)
def fake_limiter(monkeypatch):
    """Every test gets fresh, offline rate-limit state."""
    import app.rate_limit as rate_limit
    db = FakeLimiterDB()
    monkeypatch.setattr(rate_limit, '_rpc', db.rpc)
    return db
