import uuid
from datetime import datetime, timedelta, timezone

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
    monkeypatch.setattr(routes, 'get_analytics_summary', lambda days=30: {'ok': True})

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


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


def create_key(client, email='approved@example.com', **body):
    r = client.post('/api-keys', json={'name': 'CI', **body}, headers=bearer(f'valid-{email}'))
    assert r.status_code == 201, r.get_json()
    return r.get_json()


# --- key management -------------------------------------------------------------------------------------------------

def test_create_returns_key_once_and_stores_only_hash(client, fake_db):
    body = create_key(client)
    assert body['key'].startswith('tc_')
    assert body['key_prefix'] == body['key'][:10]
    stored = fake_db.db['api_keys'][0]
    assert body['key'] not in stored.values()
    assert stored['key_hash'] == api_keys._hash(body['key'])

    listed = client.get('/api-keys', headers=bearer('valid-approved@example.com')).get_json()
    assert len(listed) == 1
    assert 'key' not in listed[0] and 'key_hash' not in listed[0]


def test_list_only_shows_own_keys(client):
    create_key(client, 'approved@example.com')
    create_key(client, 'other@example.com')
    listed = client.get('/api-keys', headers=bearer('valid-approved@example.com')).get_json()
    assert len(listed) == 1


@pytest.mark.parametrize('body', [{'name': ''}, {'name': 'x' * 101}, {'expires_in_days': 0},
                                  {'expires_in_days': 366}, {'expires_in_days': '30'}, {'expires_in_days': True}])
def test_create_validates_input(client, body):
    r = client.post('/api-keys', json={'name': 'CI', **body}, headers=bearer('valid-approved@example.com'))
    assert r.status_code == 400


def test_active_key_limit(client):
    for _ in range(api_keys.MAX_ACTIVE_KEYS_PER_USER):
        create_key(client)
    r = client.post('/api-keys', json={'name': 'one too many'}, headers=bearer('valid-approved@example.com'))
    assert r.status_code == 400


def test_cannot_revoke_someone_elses_key(client):
    other_key = create_key(client, 'other@example.com')
    r = client.delete(f"/api-keys/{other_key['id']}", headers=bearer('valid-approved@example.com'))
    assert r.status_code == 404
    assert client.post('/run', headers=bearer(other_key['key'])).status_code == 200


def test_revoke_unknown_or_malformed_id_is_404(client):
    assert client.delete(f'/api-keys/{uuid.uuid4()}', headers=bearer('valid-approved@example.com')).status_code == 404
    assert client.delete('/api-keys/not-a-uuid', headers=bearer('valid-approved@example.com')).status_code == 404


def test_key_management_requires_browser_login(client):
    key = create_key(client)['key']
    assert client.get('/api-keys', headers=bearer(key)).status_code == 401
    assert client.post('/api-keys', json={'name': 'x'}, headers=bearer(key)).status_code == 401


def test_admin_key_routes_require_admin(client):
    assert client.get('/admin/api-keys', headers=bearer('valid-approved@example.com')).status_code == 403


# --- using a key ----------------------------------------------------------------------------------------------------

@pytest.mark.parametrize('path', ['/run', '/run-and-download-xml'])
def test_valid_key_can_run_checker(client, path):
    key = create_key(client)['key']
    r = client.post(path, headers=bearer(key))
    # /run-and-download-xml fails later (no real checker output) but must get past auth.
    assert r.status_code not in (401, 403)
    assert client.run_calls[-1]['user_id'] == 'user-1'


def test_key_runs_are_recorded_as_api_even_with_spoofed_source(client):
    key = create_key(client)['key']
    client.post('/run', headers={**bearer(key), 'X-Source': 'react-frontend'})
    assert client.run_calls[-1]['source_type'] == 'api'


def test_key_use_updates_last_used_at(client, fake_db):
    key = create_key(client)['key']
    assert fake_db.db['api_keys'][0]['last_used_at'] is None
    client.post('/run', headers=bearer(key))
    assert fake_db.db['api_keys'][0]['last_used_at'] is not None


def test_revoked_key_is_rejected(client):
    created = create_key(client)
    r = client.delete(f"/api-keys/{created['id']}", headers=bearer('valid-approved@example.com'))
    assert r.status_code == 204
    assert client.post('/run', headers=bearer(created['key'])).status_code == 401


def test_expired_key_is_rejected(client, fake_db):
    key = create_key(client)['key']
    fake_db.db['api_keys'][0]['expires_at'] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    assert client.post('/run', headers=bearer(key)).status_code == 401


def test_key_of_deleted_user_is_rejected(client, fake_db):
    key = create_key(client)['key']
    fake_db.db['users'] = [u for u in fake_db.db['users'] if u['id'] != 'user-1']
    assert client.post('/run', headers=bearer(key)).status_code == 401


@pytest.mark.parametrize('token', ['tc_', 'tc_short', 'tc_' + 'a' * 44, 'tc_' + 'a' * 42 + '!'])
def test_malformed_key_is_rejected_without_db_lookup(client, fake_db, monkeypatch, token):
    monkeypatch.setattr(fake_db, 'table', lambda name: pytest.fail('malformed key reached the database'))
    assert client.post('/run', headers=bearer(token)).status_code == 401


def test_generated_keys_match_expected_format(client):
    assert api_keys.KEY_PATTERN.fullmatch(create_key(client)['key'])


def test_unknown_key_is_rejected(client):
    assert client.post('/run', headers=bearer('tc_' + 'a' * 43)).status_code == 401


@pytest.mark.parametrize('path', ['/analytics/summary', '/me', '/admin/users', '/admin/api-keys'])
def test_key_is_not_accepted_outside_checker_routes(client, path):
    key = create_key(client)['key']
    assert client.get(path, headers=bearer(key)).status_code == 401
