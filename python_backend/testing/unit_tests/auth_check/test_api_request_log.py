"""Requests made with an API key are logged to api_requests, for the admin API usage page."""
import pytest

import app.routes as routes
from app.utils import CheckFailed


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


def create_key(client):
    r = client.post('/api-keys', json={'name': 'CI'}, headers=bearer('valid-approved@example.com'))
    assert r.status_code == 201, r.get_json()
    return r.get_json()


@pytest.fixture
def logged(fake_db):
    fake_db.db['api_requests'] = []
    return fake_db.db['api_requests']


def test_logs_a_successful_key_request_with_its_key_endpoint_and_run(client, logged):
    created = create_key(client)
    assert client.post('/v1/checks/summary', headers=bearer(created['key'])).status_code == 200
    [row] = logged
    assert row['key_id'] == created['id'] and row['user_id'] == 'user-1'
    assert (row['method'], row['endpoint'], row['status_code'], row['error_code']) == ('POST', '/v1/checks/summary', 200, None)
    assert row['run_id'] == 'run-1'
    assert row['request_id'] and row['duration_ms'] >= 0 and row['request_bytes'] > 0


def test_logs_an_unknown_key_without_a_key_or_user(client, logged):
    assert client.post('/v1/checks', headers=bearer('tc_' + 'a' * 43)).status_code == 401
    [row] = logged
    assert (row['key_id'], row['user_id'], row['status_code'], row['error_code']) == (None, None, 401, 'unauthorized')
    assert row['run_id'] is None


def test_logs_requests_rejected_before_a_run(client, logged):
    key = create_key(client)['key']
    assert client.post('/v1/checks', headers=bearer(key), data={}).status_code == 400
    assert logged[-1]['error_code'] == 'missing_file' and logged[-1]['run_id'] is None


def test_logs_the_run_of_a_crashed_check(client, logged, monkeypatch):
    def crash(*args, **kwargs):
        raise CheckFailed('run-9')
    monkeypatch.setattr(routes, 'run_check', crash)
    key = create_key(client)['key']
    assert client.post('/v1/checks', headers=bearer(key)).status_code == 500
    assert (logged[-1]['error_code'], logged[-1]['run_id']) == ('check_failed', 'run-9')


def test_browser_requests_are_not_logged(client, logged):
    create_key(client)
    client.post('/v1/checks', headers=bearer('valid-approved@example.com'))
    client.get('/api-keys', headers=bearer('valid-approved@example.com'))
    assert logged == []


def test_a_logging_failure_never_fails_the_request(client, fake_db):
    key = create_key(client)['key']  # no api_requests table in the fake: the insert raises
    assert client.post('/v1/checks', headers=bearer(key)).status_code == 200
