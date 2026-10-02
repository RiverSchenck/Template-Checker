import pytest
from run import app as flask_app
import app.routes as routes


@pytest.fixture
def client(monkeypatch):
    # Pretend any token "valid-<email>" is a Supabase JWT for that email; anything else is invalid.
    def fake_verify(token):
        if token.startswith('valid-'):
            return {'sub': 'uid-1', 'email': token[len('valid-'):]}
        return None
    monkeypatch.setattr(routes, 'verify_supabase_token', fake_verify)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email',
                        lambda email: {'id': '1', 'email': email} if email == 'approved@example.com' else None)
    monkeypatch.setattr(routes, 'get_analytics_summary', lambda days=30: {'ok': True})
    return flask_app.test_client()


def test_no_token_is_rejected(client):
    assert client.get('/analytics/summary').status_code == 401


def test_invalid_token_is_rejected(client):
    assert client.get('/analytics/summary', headers={'Authorization': 'Bearer nope'}).status_code == 401


def test_query_string_token_is_ignored(client):
    assert client.get('/analytics/summary?token=valid-approved@example.com').status_code == 401


def test_signed_in_but_not_approved_is_forbidden(client):
    r = client.get('/analytics/summary', headers={'Authorization': 'Bearer valid-stranger@gmail.com'})
    assert r.status_code == 403
    assert r.get_json()['error']['code'] == 'access_denied'


def test_approved_user_is_allowed(client):
    r = client.get('/analytics/summary', headers={'Authorization': 'Bearer valid-approved@example.com'})
    assert r.status_code == 200


def test_extension_token_route_is_gone(client):
    assert client.get('/api/extension-token').status_code == 404
