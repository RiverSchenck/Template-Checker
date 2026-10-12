"""Every check endpoint answers errors the same way: {"error": {"code", "message", "request_id"}}."""
import pytest

import app.routes as routes
from app.utils import CheckFailed

USER = {'Authorization': 'Bearer valid-approved@example.com'}
CHECK_PATHS = ['/run', '/run-and-download-xml', '/summary']


def _error(response):
    error = response.get_json()['error']
    assert {'code', 'message', 'request_id'} <= set(error)
    assert error['request_id'] == response.headers['X-Request-ID']
    return error


@pytest.mark.parametrize('path', CHECK_PATHS)
def test_unauthorized(client, path):
    r = client.post(path)
    assert r.status_code == 401
    assert _error(r)['code'] == 'unauthorized'


@pytest.mark.parametrize('path', CHECK_PATHS)
def test_not_an_approved_user(client, path):
    r = client.post(path, headers={'Authorization': 'Bearer valid-stranger@example.com'})
    assert r.status_code == 403
    assert _error(r)['code'] == 'access_denied'
    assert r.get_json()['allowed'] is False  # the web app reads this


@pytest.mark.parametrize('path', CHECK_PATHS)
def test_missing_file(client, path):
    r = client.post(path, headers=USER, data={}, content_type='multipart/form-data')
    assert r.status_code == 400
    assert _error(r)['code'] == 'missing_file'
    assert client.run_calls == []


@pytest.mark.parametrize('path', ['/run', '/run-and-download-xml'])
def test_upload_failure(client, monkeypatch, path):
    monkeypatch.setattr(routes, 'upload_file', lambda: {'status': 'error', 'error': {'message': 'disk full at /srv'}})
    r = client.post(path, headers=USER)
    assert r.status_code == 500
    error = _error(r)
    assert error['code'] == 'upload_failed'
    assert '/srv' not in error['message']


@pytest.mark.parametrize('path', ['/run', '/run-and-download-xml'])
def test_checker_crash(client, monkeypatch, path):
    def crash(*a, **k):
        raise CheckFailed()
    monkeypatch.setattr(routes, 'run_check', crash)
    r = client.post(path, headers=USER)
    assert r.status_code == 500
    assert _error(r)['code'] == 'check_failed'


def test_xml_export_failure_hides_server_paths(client, monkeypatch):
    class Checker:
        def get_template_name(self):
            return 'Brochure'

        def zip_idml_output_folder(self):
            return '/srv/app/src/data/missing.zip'

        def delete_unzipped_root_path(self):
            pass
    monkeypatch.setattr(routes, 'FrontifyChecker', Checker)

    r = client.post('/run-and-download-xml', headers=USER)

    assert r.status_code == 500
    error = _error(r)
    assert error['code'] == 'export_failed'
    assert '/srv' not in r.get_data(as_text=True)


def test_xml_export_is_named_after_the_template(client, monkeypatch, tmp_path):
    export = tmp_path / 'export.zip'
    export.write_bytes(b'PK')

    class Checker:
        def get_template_name(self):
            return 'Flyer-Sales_Bad.zip'  # the checker keeps the upload's extension

        def zip_idml_output_folder(self):
            return str(export)

        def delete_unzipped_root_path(self):
            pass
    monkeypatch.setattr(routes, 'FrontifyChecker', Checker)

    r = client.post('/v1/checks/xml', headers=USER)

    assert r.status_code == 200
    assert r.headers['Content-Disposition'] == 'attachment; filename=Flyer-Sales_Bad-xml.zip'
