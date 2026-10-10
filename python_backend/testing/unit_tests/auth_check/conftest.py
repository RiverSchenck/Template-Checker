"""Shared fakes for auth / API key / rate limit route tests: an in-memory Supabase and a client with a stubbed checker."""
import uuid
from datetime import datetime, timezone

import pytest
from run import app as flask_app
import app.routes as routes
import app.api_keys as api_keys

APPROVED = {'id': 'user-1', 'email': 'approved@example.com'}
OTHER = {'id': 'user-2', 'email': 'other@example.com'}


class FakeQuery:
    """Just enough of the supabase-py query builder for app.api_keys."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.payload = db, table, [], 'select', None
        self.embed_users = False

    def select(self, columns='*'):
        self.embed_users = 'users(*)' in columns
        return self

    def insert(self, row):
        self.op, self.payload = 'insert', row
        return self

    def update(self, values):
        self.op, self.payload = 'update', values
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def is_(self, col, val):
        self.filters.append(lambda r: r.get(col) is None)
        return self

    def in_(self, col, vals):
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def order(self, *a, **k):
        return self

    def limit(self, n):
        return self

    def execute(self):
        rows = self.db[self.table]
        if self.op == 'insert':
            row = {'id': str(uuid.uuid4()), 'created_at': datetime.now(timezone.utc).isoformat(),
                   'last_used_at': None, 'revoked_at': None, **self.payload}
            rows.append(row)
            return type('R', (), {'data': [dict(row)]})
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == 'update':
            for r in matched:
                r.update(self.payload)
        out = [dict(r) for r in matched]
        if self.embed_users:
            for r in out:
                r['users'] = next((u for u in self.db['users'] if u['id'] == r['user_id']), None)
        return type('R', (), {'data': out})


class FakeSupabase:
    def __init__(self):
        self.db = {'api_keys': [], 'users': [dict(APPROVED), dict(OTHER)]}

    def table(self, name):
        return FakeQuery(self.db, name)


@pytest.fixture
def fake_db(monkeypatch):
    sb = FakeSupabase()
    monkeypatch.setattr(api_keys, 'get_supabase_client', lambda: sb)
    monkeypatch.setattr(routes, 'get_supabase_client', lambda: sb)
    return sb


@pytest.fixture
def client(monkeypatch, fake_db):
    def fake_verify(token):
        if token.startswith('valid-'):
            return {'sub': 'uid-' + token, 'email': token[len('valid-'):]}
        return None

    def get_user_by_email(email):
        return next((dict(u) for u in fake_db.db['users'] if u['email'] == email), None)

    monkeypatch.setattr(routes, 'verify_supabase_token', fake_verify)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email', get_user_by_email)
    monkeypatch.setattr(routes.user_helpers, 'is_admin', lambda email=None, auth_user_id=None: False)
    monkeypatch.setattr(routes, 'get_overview', lambda period: {'ok': True})

    # Don't run the real checker; just record who the run was attributed to.
    calls = []

    def fake_start_check(checker, path, source_type='api', user_id=None):
        calls.append({'source_type': source_type, 'user_id': user_id})
        return {'ok': True}, 200
    monkeypatch.setattr(routes, 'upload_file', lambda: {'status': 'success', 'path': '/tmp/x.zip'})
    monkeypatch.setattr(routes, 'start_check', fake_start_check)
    monkeypatch.setattr(routes, 'checker_cleanup', lambda checker: None)

    c = flask_app.test_client()
    c.run_calls = calls
    return c
