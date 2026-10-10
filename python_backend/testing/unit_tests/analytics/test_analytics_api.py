"""Analytics endpoints: parameter validation and what gets passed to the SQL functions (migrations/007).

The SQL itself is exercised against a real Postgres separately; these tests stay offline.
"""
from datetime import datetime, timezone

import pytest
from run import app as flask_app
import app.analytics_api as analytics_api
import app.routes as routes
from app.analytics_api import AnalyticsQueryError, analytics_period

NOW = datetime(2026, 10, 10, 14, 30, tzinfo=timezone.utc)


def test_period_starts_at_local_midnight():
    period = analytics_period(7, 'America/New_York', now=NOW)
    assert period['start'] == '2026-10-04T00:00:00-04:00'
    assert period['end'] == '2026-10-10T14:30:00+00:00'
    assert period['bucket'] == 'day'


def test_period_start_uses_offset_of_that_day_across_dst():
    # Zurich leaves summer time on 25 Oct; a range starting before that starts at +02:00.
    period = analytics_period(14, 'Europe/Zurich', now=datetime(2026, 11, 2, 12, tzinfo=timezone.utc))
    assert period['start'] == '2026-10-20T00:00:00+02:00'


def test_period_defaults_to_utc_and_weekly_buckets_for_long_ranges():
    period = analytics_period('365', None, now=NOW)
    assert period['tz'] == 'UTC'
    assert period['start'] == '2025-10-11T00:00:00+00:00'
    assert period['bucket'] == 'week'
    assert analytics_period(90, None, now=NOW)['bucket'] == 'day'
    assert analytics_period(91, None, now=NOW)['bucket'] == 'week'


@pytest.mark.parametrize('days', [0, 367, -1, 'abc', None, '1.5'])
def test_period_rejects_bad_days(days):
    with pytest.raises(AnalyticsQueryError):
        analytics_period(days, 'UTC', now=NOW)


@pytest.mark.parametrize('tz', ['Mars/Olympus_Mons', '../../etc/passwd', 'UTC; drop table runs'])
def test_period_rejects_bad_timezones(tz):
    with pytest.raises(AnalyticsQueryError):
        analytics_period(7, tz, now=NOW)


def test_custom_range_covers_whole_local_days():
    period = analytics_period(tz='Europe/Zurich', start='2026-09-01', end='2026-09-30', now=NOW)
    assert period['start'] == '2026-09-01T00:00:00+02:00'
    assert period['end'] == '2026-10-01T00:00:00+02:00'
    assert period['bucket'] == 'day'


def test_custom_range_ending_today_stops_at_now():
    period = analytics_period(tz='UTC', start='2026-10-01', end='2026-10-10', now=NOW)
    assert period['end'] == '2026-10-10T14:30:00+00:00'
    # An end date past today is treated as today.
    assert analytics_period(tz='UTC', start='2026-10-01', end='2027-01-01', now=NOW)['end'] == period['end']


def test_long_custom_range_is_weekly():
    assert analytics_period(start='2026-01-01', end='2026-06-30', now=NOW)['bucket'] == 'week'


@pytest.mark.parametrize('start,end', [
    ('2026-10-01', None),
    (None, '2026-10-01'),
    ('2026-10-05', '2026-10-01'),
    ('2026-11-01', '2026-11-05'),
    ('2025-01-01', '2026-10-01'),
    ('01/10/2026', '2026-10-05'),
    ('2026-02-30', '2026-03-05'),
])
def test_custom_range_rejects_bad_ranges(start, end):
    with pytest.raises(AnalyticsQueryError):
        analytics_period(start=start, end=end, now=NOW)


class FakeRpc:
    def __init__(self, result=None, error=None):
        self.calls, self.result, self.error = [], result or {'ok': True}, error

    def rpc(self, name, params):
        self.calls.append((name, params))
        if self.error:
            raise self.error
        return type('Q', (), {'execute': lambda q: type('R', (), {'data': self.result})})()


@pytest.fixture
def fake_rpc(monkeypatch):
    fake = FakeRpc()
    monkeypatch.setattr(analytics_api, 'get_supabase_client', lambda: fake)
    return fake


PERIOD = analytics_period(7, 'UTC', now=NOW)


def test_runs_passes_filters_and_turns_blanks_into_null(fake_rpc):
    filters = analytics_api.run_filters(status='failed', source='', user_id=None, search='  Flyer  ',
                                        validation_type='FONTS_INCLUDED')
    analytics_api.get_runs(PERIOD, filters, limit='10', offset='20')
    [(name, params)] = fake_rpc.calls
    assert name == 'analytics_runs'
    assert params['p_status'] == 'failed'
    assert params['p_source'] is None
    assert params['p_user_id'] is None
    assert params['p_search'] == 'Flyer'
    assert params['p_validation_type'] == 'FONTS_INCLUDED'
    assert (params['p_limit'], params['p_offset']) == (10, 20)


@pytest.mark.parametrize('kwargs', [
    {'status': 'crashed'},
    {'source': 'desktop'},
    {'user_id': 'not-a-uuid'},
    {'validation_type': "FONTS'; --"},
    {'search': 'x' * 201},
])
def test_run_filters_reject_bad_values(kwargs):
    with pytest.raises(AnalyticsQueryError):
        analytics_api.run_filters(**kwargs)


@pytest.mark.parametrize('limit,offset', [(0, 0), (101, 0), (10, -1), ('ten', 0)])
def test_runs_rejects_bad_paging(fake_rpc, limit, offset):
    with pytest.raises(AnalyticsQueryError):
        analytics_api.get_runs(PERIOD, analytics_api.run_filters(), limit=limit, offset=offset)
    assert fake_rpc.calls == []


def test_overview_and_issue_detail_call_their_functions(fake_rpc):
    analytics_api.get_overview(analytics_period(120, 'Europe/Zurich', now=NOW))
    analytics_api.get_issue_detail('OVERRIDE', PERIOD)
    (overview, overview_params), (detail, detail_params) = fake_rpc.calls
    assert overview == 'analytics_overview'
    assert overview_params['p_bucket'] == 'week' and overview_params['p_tz'] == 'Europe/Zurich'
    assert detail == 'analytics_issue_detail'
    assert detail_params['p_validation_type'] == 'OVERRIDE' and detail_params['p_bucket'] == 'day'


def test_csv_export_neutralizes_formulas_and_reports_truncation(fake_rpc):
    fake_rpc.result = {'total': 12000, 'runs': [
        {'id': 'r1', 'timestamp': '2026-10-01T10:00:00+00:00', 'template_name': '=HYPERLINK("http://x","y")',
         'status': 'failed', 'error_message': '-1 is not valid', 'display_name': None, 'total_errors': 0},
        {'id': 'r2', 'template_name': 'Brochure, A4.zip', 'status': 'completed', 'total_errors': 3},
    ]}
    export = analytics_api.export_runs_csv(PERIOD, analytics_api.run_filters(status='failed'))
    [(name, params)] = fake_rpc.calls
    assert name == 'analytics_runs'
    assert params['p_limit'] == analytics_api.MAX_EXPORT_ROWS and params['p_status'] == 'failed'
    assert (export['total'], export['exported']) == (12000, 2)
    lines = export['csv'].splitlines()
    assert lines[0].startswith('Time (UTC),Template,Result,Source,Agent')
    assert '\'=HYPERLINK' in lines[1] and "'-1 is not valid" in lines[1]
    assert '"Brochure, A4.zip"' in lines[2]


@pytest.fixture
def client(monkeypatch, fake_rpc):
    monkeypatch.setattr(routes, 'verify_supabase_token',
                        lambda token: {'sub': 'uid-1', 'email': 'approved@example.com'} if token == 'ok' else None)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email',
                        lambda email: {'id': '1', 'email': email} if email == 'approved@example.com' else None)
    return flask_app.test_client()


AUTH = {'Authorization': 'Bearer ok'}


def test_overview_endpoint(client, fake_rpc):
    r = client.get('/analytics/overview?days=7&tz=UTC', headers=AUTH)
    assert r.status_code == 200
    assert r.get_json() == {'ok': True}
    assert fake_rpc.calls[0][0] == 'analytics_overview'


def test_bad_parameters_are_a_generic_400_and_the_reason_is_only_logged(client, fake_rpc, caplog):
    generic = {'error': {'message': 'Invalid analytics request. Check the date range and filters.'}}
    with caplog.at_level('INFO'):
        r = client.get('/analytics/overview?days=9999', headers=AUTH)
    assert (r.status_code, r.get_json()) == (400, generic)
    assert 'days must be between' in caplog.text
    for path in ('/analytics/runs?status=nope', '/analytics/issues/bad-type!', '/analytics/runs.csv?status=nope'):
        r = client.get(path, headers=AUTH)
        assert (r.status_code, r.get_json()) == (400, generic)
    assert fake_rpc.calls == []


def test_database_errors_are_a_generic_500(client, fake_rpc):
    fake_rpc.error = RuntimeError('relation "runs" does not exist')
    r = client.get('/analytics/runs?days=7', headers=AUTH)
    assert r.status_code == 500
    assert r.get_json() == {'error': {'message': 'Failed to load analytics'}}


def test_analytics_requires_sign_in(client):
    for path in ('/analytics/overview', '/analytics/runs', '/analytics/issues/OVERRIDE'):
        assert client.get(path).status_code == 401


def test_issues_get_labels_from_the_checker_classifiers(fake_rpc):
    fake_rpc.result = {'issues': [{'validation_type': 'FONTS_INCLUDED'}, {'validation_type': 'SOMETHING_NEW'}]}
    issues = analytics_api.get_overview(PERIOD)['issues']
    assert issues[0]['label'] == 'Fonts Included'
    assert issues[0]['message'] == 'Package is missing fonts.'
    assert issues[0]['help_article'].startswith('http')
    # A type the classifiers don't know (e.g. one removed since) still gets a readable label.
    assert issues[1] == {'validation_type': 'SOMETHING_NEW', 'label': 'Something New', 'message': None, 'help_article': None}


def test_issue_description_follows_severity_when_a_type_is_both_error_and_warning():
    assert analytics_api.describe_issue('IMAGE_TRANSFORMATION', 'error')['message'] == 'Image transformations are not supported.'
    assert analytics_api.describe_issue('IMAGE_TRANSFORMATION', 'warning')['message'].startswith('Element has been rotated')


def test_csv_endpoint_downloads_with_row_counts(client, fake_rpc):
    fake_rpc.result = {'total': 1, 'runs': [{'id': 'r1', 'template_name': 'A.zip', 'status': 'completed'}]}
    r = client.get('/analytics/runs.csv?days=7&status=completed', headers=AUTH)
    assert r.status_code == 200
    assert r.mimetype == 'text/csv'
    assert r.headers['Content-Disposition'].startswith('attachment; filename="template-checks-')
    assert (r.headers['X-Total-Rows'], r.headers['X-Exported-Rows']) == ('1', '1')
    assert 'A.zip' in r.get_data(as_text=True)


def test_csv_endpoint_rejects_bad_filters_and_needs_sign_in(client, fake_rpc):
    assert client.get('/analytics/runs.csv?status=nope', headers=AUTH).status_code == 400
    assert client.get('/analytics/runs.csv').status_code == 401
    assert fake_rpc.calls == []


def test_custom_range_through_the_api(client, fake_rpc):
    r = client.get('/analytics/overview?start=2026-09-01&end=2026-09-30&tz=Europe/Zurich', headers=AUTH)
    assert r.status_code == 200
    params = fake_rpc.calls[0][1]
    assert params['p_start'] == '2026-09-01T00:00:00+02:00'
    assert params['p_end'] == '2026-10-01T00:00:00+02:00'
    assert client.get('/analytics/overview?start=2026-09-30&end=2026-09-01', headers=AUTH).status_code == 400
