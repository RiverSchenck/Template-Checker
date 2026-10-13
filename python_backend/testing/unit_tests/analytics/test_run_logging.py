"""Every check attempt is logged to analytics with its outcome: completed, rejected (bad upload) or failed (crash)."""
import os

import pytest
from run import app as flask_app
import app.analytics as analytics
import app.utils as utils
from src.classes.FrontifyChecker import FrontifyChecker
from src.checks import Check
from src.checks.stages import States

PASS_ZIP = os.path.join(os.path.dirname(__file__), '..', 'par_check', 'pass_data', 'Blank.zip')


@pytest.fixture
def logged(monkeypatch):
    """Capture what run_check asks to log instead of writing to Supabase."""
    calls = []
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', lambda **kwargs: calls.append(kwargs) or True)
    return calls


def run_check(checker, path):
    """200 if the check ran (completed or rejected), 500 if it crashed, like the check endpoints."""
    with flask_app.test_request_context():
        try:
            utils.run_check(checker, path, 'react-frontend', user_id='user-1')
            return 200
        except utils.CheckFailed:
            return 500
        finally:
            checker.delete_unzipped_root_path()


def test_completed_run_is_logged_as_completed(logged):
    assert run_check(FrontifyChecker(), PASS_ZIP) == 200

    [call] = logged
    assert call['status'] == 'completed'
    assert call['stopped_at_stage'] is None
    assert call['error_message'] is None
    assert call['template_name'] == 'Blank.zip'
    assert call['source_type'] == 'react-frontend'
    assert call['user_id'] == 'user-1'
    assert call['file_size_bytes'] == os.path.getsize(PASS_ZIP)
    assert call['results_json'] is not None


def test_upload_that_is_not_a_zip_is_logged_as_rejected(logged, tmp_path):
    not_a_zip = tmp_path / 'brief.pdf'
    not_a_zip.write_bytes(b'%PDF-1.7')

    # The user still gets results explaining the problem, so the request itself succeeds.
    assert run_check(FrontifyChecker(), str(not_a_zip)) == 200

    [call] = logged
    assert call['status'] == 'rejected'
    assert call['stopped_at_stage'] == 'UNZIP_PACKAGE'
    assert call['error_message'] == 'File uploaded is not ZIP'
    assert call['template_name'] == 'brief.pdf'


def test_checker_crash_is_logged_as_failed(logged):
    checker = FrontifyChecker()

    def crash(doc, results):
        raise KeyError('Self')
    checker.checks[0] = Check(States.MASTERPAGE_CHECK, crash)

    assert run_check(checker, PASS_ZIP) == 500

    [call] = logged
    assert call['status'] == 'failed'
    assert call['stopped_at_stage'] == 'MASTERPAGE_CHECK'
    assert call['error_message'] == "KeyError: 'Self'"
    assert call['template_name'] == 'Blank.zip'
    assert 'results_json' not in call


def test_analytics_failure_does_not_fail_the_check(monkeypatch):
    def broken(**kwargs):
        raise RuntimeError('supabase down')
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', broken)

    assert run_check(FrontifyChecker(), PASS_ZIP) == 200


class FakeSupabase:
    def __init__(self):
        self.inserts = {'runs': [], 'validations': []}

    def table(self, name):
        db = self

        class Query:
            def insert(self, rows):
                db.inserts[name].append(rows)
                return self

            def execute(self):
                return type('R', (), {'data': [{'id': 'run-1'}]})
        return Query()


@pytest.fixture
def fake_supabase(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(analytics, 'get_supabase_client', lambda: fake)
    monkeypatch.delenv('APP_VERSION', raising=False)
    monkeypatch.setenv('FLY_IMAGE_REF', 'registry.fly.io/template-checker:deployment-01JABC')
    return fake


def test_failed_run_row_has_outcome_and_no_validations(fake_supabase):
    assert analytics.log_analytics_to_supabase(
        template_name='Crashy.zip', source_type='api', duration_ms=12, file_size_bytes=34,
        status='failed', stopped_at_stage='PARSE_XML', error_message='x' * 5000,
    )

    [row] = fake_supabase.inserts['runs']
    assert row['status'] == 'failed'
    assert row['stopped_at_stage'] == 'PARSE_XML'
    assert row['error_message'] == 'x' * analytics.MAX_ERROR_MESSAGE_LENGTH
    assert row['app_version'] == 'deployment-01JABC'
    assert (row['total_errors'], row['total_warnings'], row['total_infos']) == (0, 0, 0)
    assert fake_supabase.inserts['validations'] == []


def test_completed_run_row_defaults(fake_supabase, monkeypatch):
    monkeypatch.setenv('APP_VERSION', 'abc123')
    results = {'issues': [
        _issue('FONTS_INCLUDED', 'error', 'font', 'Helvetica', detail='Package is missing fonts.'),
    ]}

    assert analytics.log_analytics_to_supabase(
        template_name='Ok.zip', source_type='react-frontend', duration_ms=1, file_size_bytes=1, results_json=results,
    )

    [row] = fake_supabase.inserts['runs']
    assert row['status'] == 'completed'
    assert row['stopped_at_stage'] is None and row['error_message'] is None
    assert row['app_version'] == 'abc123'
    assert row['total_errors'] == 1
    [[validation]] = fake_supabase.inserts['validations']
    assert validation['validation_type'] == 'FONTS_INCLUDED' and validation['run_id'] == 'run-1'


def test_first_error_message():
    results = {'issues': [
        _issue('FONTS_INCLUDED', 'warning', 'font', 'x', detail='a warning'),
        _issue('IDML', 'error', 'document', None, detail='No IDML file found'),
    ]}
    assert analytics.first_error_message(results) == 'No IDML file found'
    assert analytics.first_error_message({}) is None


def _issue(check, severity, kind, name, detail=None):
    """An issue in results v2."""
    return {'check': check, 'severity': severity, 'subject': {'kind': kind, 'id': name, 'name': name},
            'location': {'page_id': None, 'page_name': None, 'spread_id': None, 'item_id': None, 'bounds': None},
            'facts': None, 'text': None, 'detail': detail}


def _results_with(*issues):
    return {'issues': list(issues)}


def test_severity_comes_from_the_list_an_issue_is_in():
    """The classifier name alone doesn't give the severity: it is the list (errors/warnings/infos) the issue sits in."""
    results = _results_with(
        _issue('TRANSFORMATION', 'error', 'image', 'photo.jpg'),
        _issue('UNUSED_IMAGE', 'warning', 'image', 'photo.jpg'),
        _issue('LARGE_IMAGE', 'info', 'image', 'photo.jpg'))
    assert [(v['validation_type'], v['severity']) for v in analytics.extract_individual_validations(results)] == [
        ('TRANSFORMATION', 'error'), ('UNUSED_IMAGE', 'warning'), ('LARGE_IMAGE', 'info')]
    assert analytics.extract_validation_counts(results) == {'total_errors': 1, 'total_warnings': 1, 'total_infos': 1}


def test_a_new_classifier_needs_no_analytics_change():
    results = _results_with(_issue('SOME_NEW_WARNING', 'warning', 'image', None))
    assert analytics.extract_individual_validations(results) == [
        {'validation_type': 'SOME_NEW_WARNING', 'severity': 'warning', 'category': 'image', 'identifier': ''}]
