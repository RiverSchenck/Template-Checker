"""The versioned check API, the deprecated paths it replaces, /health, and where runs are recorded as coming from."""
import pytest

import app.routes as routes
from app.utils import CheckOutcome

USER = {'Authorization': 'Bearer valid-approved@example.com'}
MOVED = [('/run', '/v1/checks'), ('/summary', '/v1/checks/summary'), ('/run-and-download-xml', '/v1/checks/xml')]


def test_v1_checks_returns_the_run_its_status_and_results(client):
    r = client.post('/v1/checks', headers=USER)

    assert r.status_code == 200
    body = r.get_json()
    assert set(body) == {'run_id', 'status', 'results', 'customer_summary'}
    assert (body['run_id'], body['status'], body['results']['template_name']) == ('run-1', 'completed', 'x.zip')
    assert 'Deprecation' not in r.headers


def test_v1_checks_says_when_a_package_was_rejected(client, monkeypatch):
    monkeypatch.setattr(routes, 'run_check', lambda *a, **k: CheckOutcome({'general': {}}, False, 'UNZIP_PACKAGE', None, None))

    body = client.post('/v1/checks', headers=USER).get_json()

    assert body['status'] == 'rejected'
    assert body['run_id'] is None


def test_old_run_path_keeps_its_response_shape(client):
    body = client.post('/run', headers=USER).get_json()
    assert body['type'] == 'data'
    assert body['content']['results']['template_name'] == 'x.zip'


@pytest.mark.parametrize('old, new', MOVED)
def test_old_paths_say_where_they_moved(client, old, new):
    r = client.post(old, headers=USER)
    assert r.headers['Deprecation'].startswith('@')
    assert r.headers['Link'] == f'<{new}>; rel="successor-version"'


@pytest.mark.parametrize('path', [new for _, new in MOVED])
def test_v1_paths_need_auth(client, path):
    assert client.post(path).status_code == 401


def test_health(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.get_json()['status'] == 'ok'
    assert 'version' in r.get_json()
    assert 'Deprecation' not in r.headers
    old = client.get('/test')
    assert old.get_json()['status'] == 'ok'
    assert old.headers['Link'] == '</health>; rel="successor-version"'


# --- where a run came from -------------------------------------------------------------------------------------------

def _source(client, headers):
    client.run_calls.clear()
    client.post('/v1/checks', headers={**USER, **headers})
    return client.run_calls[-1]['source_type']


def test_source_comes_from_the_browser_origin(client):
    assert _source(client, {'Origin': 'chrome-extension://abcdefghijklmnop'}) == 'extension'
    assert _source(client, {'Origin': 'http://localhost:3000'}) == 'react-frontend'
    # The browser-set Origin wins over a header anyone can set.
    assert _source(client, {'Origin': 'http://localhost:3000', 'X-Source': 'extension'}) == 'react-frontend'


def test_x_source_is_only_a_valid_fallback(client):
    assert _source(client, {'X-Source': 'extension'}) == 'extension'
    assert _source(client, {'X-Source': 'my-script'}) == 'api'  # unknown values used to drop the run from analytics
    assert _source(client, {}) == 'api'
    assert _source(client, {'Origin': 'https://evil.example', 'X-Source': 'nonsense'}) == 'api'


def test_api_keys_are_always_api(client, monkeypatch):
    monkeypatch.setattr(routes.api_keys, 'resolve_key', lambda key: {'id': 'user-1', 'email': 'approved@example.com'})
    assert _source(client, {'Authorization': 'Bearer tc_x', 'Origin': 'chrome-extension://abc'}) == 'api'
