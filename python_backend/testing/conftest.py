import math
import os
import shutil
import tempfile
import uuid

import pytest

# Check runs keep their files under WORK_DIR (src/pipeline/workspace.py). Point it at a folder of the test run's
# own, before the app is imported (it reads WORK_DIR at start), so tests never touch the real temp folder.
TEST_WORK_DIR = tempfile.mkdtemp(prefix='template-checker-tests-')
os.environ['WORK_DIR'] = TEST_WORK_DIR


@pytest.fixture(scope='session', autouse=True)
def remove_test_work_dir():
    """Remove the test run's WORK_DIR, with anything a failed test left in it (unpacked packages add up)."""
    yield
    shutil.rmtree(TEST_WORK_DIR, ignore_errors=True)


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


@pytest.fixture(autouse=True)
def no_real_supabase(monkeypatch):
    """Keep tests offline: no Supabase credentials, and any unpatched client lookup fails loudly.

    run.py loads .env at import, so a local run would otherwise log to production Supabase.
    Tests that need a database patch get_supabase_client themselves (their patch runs after this one).
    """
    import sys
    import app.routes  # noqa: F401  imports every module that looks up a client

    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)

    def forbidden():
        raise AssertionError('test reached the real Supabase client; patch get_supabase_client')

    for name, module in list(sys.modules.items()):
        if (name == 'app' or name.startswith('app.')) and hasattr(module, 'get_supabase_client'):
            monkeypatch.setattr(module, 'get_supabase_client', forbidden)
