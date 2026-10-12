"""Access requests: one pending request per email, no leaking who has access, and who decided recorded as users.id."""
import pytest

import app.routes as routes
from app import rate_limit

ADMIN = {'Authorization': 'Bearer valid-approved@example.com'}  # users.id 'user-1', made admin below


@pytest.fixture(autouse=True)
def limiter_allows(monkeypatch):
    monkeypatch.setattr(rate_limit, 'hit', lambda *a: (True, 0))


def _ask(client, email, headers=None):
    return client.post('/access-requests', json={'email': email, 'why_need_access': 'Support work'}, headers=headers or {})


def _requests(fake_db, email):
    return [r for r in fake_db.db['access_requests'] if r['email'] == email]


def test_anonymous_requests_are_recorded_once(client, fake_db):
    first, again = _ask(client, 'new@example.com'), _ask(client, 'NEW@example.com')

    assert (first.status_code, first.get_json()) == (202, {'email': 'new@example.com', 'status': 'received'})
    assert (again.status_code, again.get_json()) == (202, {'email': 'new@example.com', 'status': 'received'})
    assert len(_requests(fake_db, 'new@example.com')) == 1


def test_anonymous_callers_cant_tell_who_has_access(client, fake_db):
    has_access = _ask(client, 'approved@example.com')
    unknown = _ask(client, 'nobody@example.com')

    assert has_access.status_code == unknown.status_code == 202
    assert has_access.get_json()['status'] == unknown.get_json()['status'] == 'received'
    assert _requests(fake_db, 'approved@example.com') == []  # nothing recorded for someone who's already in


def test_signed_in_callers_see_their_own_request(client, monkeypatch):
    monkeypatch.setattr(routes, 'verify_supabase_token', lambda t: {'sub': 'uid-9', 'email': 'pending@example.com'})
    headers = {'Authorization': 'Bearer anything'}

    first = client.post('/access-requests', json={}, headers=headers)
    again = client.post('/access-requests', json={}, headers=headers)

    assert first.status_code == 201 and again.status_code == 200
    assert first.get_json()['id'] == again.get_json()['id']
    assert again.get_json()['status'] == 'pending'


def test_validation_errors_have_codes(client):
    r = client.post('/access-requests', json={'email': 'nope'})
    assert r.status_code == 400
    assert r.get_json()['error']['code'] == 'invalid_request'


@pytest.fixture
def as_admin(monkeypatch):
    monkeypatch.setattr(routes.user_helpers, 'is_admin', lambda email=None, auth_user_id=None: True)


def test_approving_records_the_admins_users_id(client, fake_db, as_admin):
    _ask(client, 'new@example.com')
    [req] = _requests(fake_db, 'new@example.com')

    r = client.patch(f"/admin/access-requests/{req['id']}", json={'status': 'approved'}, headers=ADMIN)

    assert r.status_code == 200
    assert r.get_json()['decided_by'] == 'user-1'  # users.id, not the Supabase login id ('uid-…')
    new_user = next(u for u in fake_db.db['users'] if u['email'] == 'new@example.com')
    assert new_user['approved_by'] == 'user-1'


def test_conflicts_are_409(client, fake_db, as_admin):
    _ask(client, 'new@example.com')
    [req] = _requests(fake_db, 'new@example.com')
    client.patch(f"/admin/access-requests/{req['id']}", json={'status': 'approved'}, headers=ADMIN)

    again = client.patch(f"/admin/access-requests/{req['id']}", json={'status': 'approved'}, headers=ADMIN)
    reject = client.patch(f"/admin/access-requests/{req['id']}", json={'status': 'rejected'}, headers=ADMIN)

    assert again.status_code == reject.status_code == 409
    assert again.get_json()['error']['code'] == 'conflict'


def test_inviting_answers_a_waiting_request(client, fake_db, as_admin):
    _ask(client, 'new@example.com')

    r = client.post('/admin/invites', json={'email': 'new@example.com'}, headers=ADMIN)

    assert r.status_code == 201
    [req] = _requests(fake_db, 'new@example.com')
    assert (req['status'], req['decided_by']) == ('approved', 'user-1')


def test_admin_routes_answer_with_codes(client):
    r = client.get('/admin/access-requests', headers=ADMIN)
    assert r.status_code == 403
    assert r.get_json()['error']['code'] == 'forbidden'


def test_admins_cant_remove_themselves(client, as_admin):
    r = client.delete('/admin/users/user-1', headers=ADMIN)
    assert r.status_code == 409
    assert r.get_json()['error']['code'] == 'conflict'
