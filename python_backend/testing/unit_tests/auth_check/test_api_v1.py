"""The versioned check API, /health, and where runs are recorded as coming from."""
import pytest

import app.routes as routes
from app.utils import CheckOutcome

USER = {'Authorization': 'Bearer valid-approved@example.com'}


def test_v1_checks_returns_the_run_its_status_and_results(client):
    r = client.post('/v1/checks', headers=USER)

    assert r.status_code == 200
    body = r.get_json()
    assert set(body) == {'run_id', 'status', 'results', 'customer_summary'}
    assert (body['run_id'], body['status'], body['results']['template_name']) == ('run-1', 'completed', 'x.zip')


def test_v1_checks_says_when_a_package_was_rejected(client, monkeypatch):
    monkeypatch.setattr(routes, 'run_check', lambda *a, **k: CheckOutcome({'general': {}}, False, 'UNZIP_PACKAGE', None, None))

    body = client.post('/v1/checks', headers=USER).get_json()

    assert body['status'] == 'rejected'
    assert body['run_id'] is None


@pytest.mark.parametrize('path', ['/v1/checks', '/v1/checks/summary', '/v1/checks/xml'])
def test_v1_paths_need_auth(client, path):
    assert client.post(path).status_code == 401


def test_health(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.get_json()['status'] == 'ok'
    assert 'version' in r.get_json()


# --- where a run came from -------------------------------------------------------------------------------------------

def _source(client, headers):
    client.run_calls.clear()
    client.post('/v1/checks', headers={**USER, **headers})
    return client.run_calls[-1]['source_type']


def test_signed_in_checks_are_from_the_web_app_whatever_the_headers(client):
    assert _source(client, {}) == 'react-frontend'
    assert _source(client, {'Origin': 'chrome-extension://abcdefghijklmnop', 'X-Source': 'api'}) == 'react-frontend'


def test_api_keys_are_always_api(client, monkeypatch):
    monkeypatch.setattr(routes.api_keys, 'resolve_key', lambda key: {'id': 'user-1', 'email': 'approved@example.com'})
    assert _source(client, {'Authorization': 'Bearer tc_x'}) == 'api'
