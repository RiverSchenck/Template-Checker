"""POST /summary: auth, validation, error codes, and an end-to-end run of the real checker on a test package.

Nothing here talks to Supabase: auth lookups, the rate limiter and analytics logging are stubbed.
"""
import io
import json
import os

import pytest

import app.routes as routes
import app.utils as utils
from app import rate_limit
from app.customer_summary.payload import SUMMARY_VERSION
from app.utils import CheckFailed
from run import app as flask_app

TESTING_DIR = os.path.join(os.path.dirname(__file__), '..', '..')
PACKAGE = 'Brochure_Bad'
USER_ROW = {'id': 'user-1', 'email': 'approved@example.com'}
AUTH = {'Authorization': 'Bearer valid-approved@example.com'}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, 'verify_supabase_token',
                        lambda token: {'sub': 'uid-1', 'email': token[len('valid-'):]} if token.startswith('valid-') else None)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email',
                        lambda email: dict(USER_ROW) if email == USER_ROW['email'] else None)
    monkeypatch.setattr(rate_limit, 'acquire', lambda bucket: (bucket, 'lease-1'))
    monkeypatch.setattr(rate_limit, 'hit', lambda bucket, limit, window: (True, 0))
    monkeypatch.setattr(rate_limit, 'release', lambda handle: None)

    logged = []
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', lambda **kwargs: logged.append(kwargs) or 'run-123')

    c = flask_app.test_client()
    c.logged = logged
    return c


def _package_bytes(package=PACKAGE):
    with open(os.path.join(TESTING_DIR, 'packages', package + '.zip'), 'rb') as f:
        return f.read()


def _post(client, data=None, filename='Brochure_Bad.zip', headers=AUTH):
    files = {} if data is None else {'file': (io.BytesIO(data), filename)}
    return client.post('/v1/checks/summary', data=files, headers=headers, content_type='multipart/form-data')


def _expected_summary(package=PACKAGE):
    with open(os.path.join(TESTING_DIR, 'golden', 'summaries', package + '.json'), encoding='utf-8') as f:
        return json.load(f)


# --- success -------------------------------------------------------------------------------------------------------

def test_returns_the_summary_for_a_real_package(client):
    r = _post(client, _package_bytes())

    assert r.status_code == 200
    body = r.get_json()
    expected = _expected_summary()
    assert body['html'] == expected['html']
    assert body['text'] == expected['plain_text']  # plain text with links written out
    assert body['summary_version'] == SUMMARY_VERSION
    assert body['run_id'] == 'run-123'
    assert body['template_name'] == 'Brochure_Bad'
    # Kinds of blocker: paragraph style, columns, missing font (Minion Pro), Adobe Font (Playfair Display), variable font.
    assert body['counts'] == {'blockers': 5, 'warnings': 3, 'infos': 0}
    assert set(body) == {'summary_version', 'run_id', 'template_name', 'counts', 'html', 'text'}
    assert r.headers['Cache-Control'] == 'no-store'


def test_logs_the_run_to_analytics_as_the_caller(client):
    _post(client, _package_bytes(), headers=AUTH)

    [run] = client.logged
    assert run['user_id'] == 'user-1'
    assert run['source_type'] == 'react-frontend'
    assert run['status'] == 'completed'


def test_run_id_is_null_when_analytics_is_unavailable(client, monkeypatch):
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', lambda **kwargs: None)

    r = _post(client, _package_bytes())

    assert r.status_code == 200
    assert r.get_json()['run_id'] is None


def test_accepts_api_keys(client, monkeypatch):
    monkeypatch.setattr(routes.api_keys, 'resolve_key', lambda key: dict(USER_ROW) if key == 'tc_good' else None)

    assert _post(client, _package_bytes(), headers={'Authorization': 'Bearer tc_good'}).status_code == 200
    assert client.logged[0]['source_type'] == 'api'
    assert _post(client, _package_bytes(), headers={'Authorization': 'Bearer tc_bad'}).status_code == 401


def test_removes_the_upload_afterwards(client):
    upload_root = flask_app.config['UPLOAD_FOLDER']
    before = set(os.listdir(upload_root))

    _post(client, _package_bytes())

    assert set(os.listdir(upload_root)) == before


def test_run_includes_the_summary_and_the_checks_for_the_web_app(client):
    r = client.post('/v1/checks', data={'file': (io.BytesIO(_package_bytes()), 'Brochure_Bad.zip')}, headers=AUTH,
                    content_type='multipart/form-data')

    assert r.status_code == 200
    content = r.get_json()
    results, summary = content['results'], content['customer_summary']
    expected = _expected_summary()
    assert summary['html'] == expected['html']
    assert summary['text'] == expected['plain_text']
    assert summary['summary_version'] == SUMMARY_VERSION
    review_text = '\n\n'.join('\n'.join(('• ' if l['kind'] == 'step' else '') + l['text'] for l in s['lines'])
                               for s in summary['sections'])
    assert review_text == expected['text']
    fonts, = [check for check in results['checks'] if check['key'] == 'FONTS_INCLUDED']
    assert fonts['title'] == 'Font missing from the package'
    assert len(client.logged) == 1  # built once, checked once


def test_run_still_returns_results_when_the_summary_fails(client, monkeypatch):
    def broken(results):
        raise KeyError('internal detail')
    monkeypatch.setattr(utils, 'build_customer_summary', broken)

    r = client.post('/v1/checks', data={'file': (io.BytesIO(_package_bytes()), 'Brochure_Bad.zip')}, headers=AUTH,
                    content_type='multipart/form-data')

    assert r.status_code == 200
    content = r.get_json()
    assert content['customer_summary'] is None
    assert content['results']['issues']


# --- request ids ---------------------------------------------------------------------------------------------------

def test_every_response_has_a_request_id(client):
    r = _post(client, None)
    assert len(r.headers['X-Request-ID']) == 32
    assert r.get_json()['error']['request_id'] == r.headers['X-Request-ID']


def test_reuses_a_valid_caller_request_id_and_replaces_anything_else(client):
    assert _post(client, None, headers={**AUTH, 'X-Request-ID': 'intercom-abc.123'}).headers['X-Request-ID'] == 'intercom-abc.123'
    for bad in ('has spaces] INFO forged', 'x' * 129, '<script>'):
        replaced = _post(client, None, headers={**AUTH, 'X-Request-ID': bad}).headers['X-Request-ID']
        assert replaced != bad and len(replaced) == 32


# --- errors --------------------------------------------------------------------------------------------------------

def _error(r):
    error = r.get_json()['error']
    assert set(error) == {'code', 'message', 'request_id'}
    assert r.headers['Cache-Control'] == 'no-store'
    return error


def test_requires_auth(client):
    assert _post(client, _package_bytes(), headers={}).status_code == 401
    assert _post(client, _package_bytes(), headers={'Authorization': 'Bearer valid-stranger@example.com'}).status_code == 403
    assert client.logged == []


def test_missing_file(client):
    r = _post(client, None)
    assert r.status_code == 400
    assert _error(r)['code'] == 'missing_file'


def test_bad_requests_dont_use_up_a_check(client, monkeypatch):
    hits = []
    monkeypatch.setattr(rate_limit, 'hit', lambda *a: hits.append(a) or (True, 0))

    _post(client, None)
    _post(client, b'x', filename='Brochure.idml')

    assert hits == []


@pytest.mark.parametrize('filename', ['Brochure.idml', 'Brochure.indd', 'Brochure'])
def test_only_zip_packages(client, filename):
    r = _post(client, b'not a zip', filename=filename)
    assert r.status_code == 400
    assert _error(r)['code'] == 'unsupported_file_type'
    assert client.logged == []


def test_unreadable_package_says_why(client):
    r = _post(client, b'definitely not a zip archive', filename='Broken.zip')

    assert r.status_code == 422
    error = _error(r)
    assert error['code'] == 'template_not_checkable'
    assert error['message'] == ('The file couldn\'t be checked: The file is not a valid ZIP archive. '
                                'Please zip the package folder again and re-upload.')
    assert client.logged[0]['status'] == 'rejected'


def test_checker_crash_is_a_500_without_details(client, monkeypatch):
    def crash(*a, **k):
        raise CheckFailed() from RuntimeError('/srv/secret/path exploded')
    monkeypatch.setattr(routes, 'run_check', crash)

    r = _post(client, _package_bytes())

    assert r.status_code == 500
    error = _error(r)
    assert error['code'] == 'check_failed'
    assert 'secret' not in r.get_data(as_text=True)


def test_summary_bug_is_a_500_without_details(client, monkeypatch):
    def broken(results):
        raise KeyError('internal detail')
    monkeypatch.setattr(utils, 'build_customer_summary', broken)

    r = _post(client, _package_bytes())

    assert r.status_code == 500
    assert _error(r)['code'] == 'summary_failed'
    assert 'internal detail' not in r.get_data(as_text=True)


def test_one_check_at_a_time(client, monkeypatch):
    monkeypatch.setattr(rate_limit, 'acquire', lambda bucket: None)

    r = _post(client, _package_bytes())

    assert r.status_code == 429
    assert r.get_json()['error']['code'] == 'check_in_progress'


def test_hourly_limit(client, monkeypatch):
    monkeypatch.setattr(rate_limit, 'hit', lambda bucket, limit, window: (False, 600))

    r = _post(client, _package_bytes())

    assert r.status_code == 429
    assert r.get_json()['error']['code'] == 'rate_limited'
    assert r.headers['Retry-After'] == '600'


def test_file_too_large(client, monkeypatch):
    monkeypatch.setitem(flask_app.config, 'MAX_CONTENT_LENGTH', 1024)

    r = _post(client, b'x' * 4096, filename='Huge.zip')

    assert r.status_code == 413
    assert r.get_json()['error']['code'] == 'file_too_large'
