"""Customer summary feedback: saving reviews and comments, who can read them, and resolving them."""
import uuid
from datetime import datetime, timezone

import pytest
from run import app as flask_app
import app.routes as routes
import app.summary_feedback as summary_feedback

AGENT = {'id': str(uuid.uuid4()), 'email': 'agent@example.com', 'display_name': 'Agent'}
OTHER = {'id': str(uuid.uuid4()), 'email': 'other@example.com', 'display_name': 'Other'}
ADMIN = {'id': str(uuid.uuid4()), 'email': 'admin@example.com', 'display_name': 'Admin'}

SUMMARY = 'We checked "Brochure" and found 2 things.\n\n1. Fonts missing\n   Add the fonts to the package.'


class FakeQuery:
    """Just enough of the supabase-py query builder for app.summary_feedback."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.payload, self._negate = db, table, [], 'select', None, False

    def select(self, columns='*'):
        return self

    def insert(self, rows):
        self.op, self.payload = 'insert', rows
        return self

    def update(self, values):
        self.op, self.payload = 'update', values
        return self

    @property
    def not_(self):
        self._negate = True
        return self

    def _add(self, test):
        negate, self._negate = self._negate, False
        self.filters.append((lambda r: not test(r)) if negate else test)
        return self

    def eq(self, col, val):
        return self._add(lambda r: r.get(col) == val)

    def is_(self, col, val):
        return self._add(lambda r: r.get(col) is None)

    def in_(self, col, vals):
        return self._add(lambda r: r.get(col) in vals)

    def order(self, *a, **k):
        return self

    def limit(self, n):
        return self

    def execute(self):
        rows = self.db[self.table]
        if self.op == 'insert':
            new = []
            for row in self.payload if isinstance(self.payload, list) else [self.payload]:
                full = {'id': str(uuid.uuid4()), 'created_at': datetime.now(timezone.utc).isoformat(),
                        'resolved_at': None, 'resolved_by': None, **row}
                rows.append(full)
                new.append(dict(full))
            return type('R', (), {'data': new})
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == 'update':
            for r in matched:
                r.update(self.payload)
        return type('R', (), {'data': [dict(r) for r in matched]})


class FakeSupabase:
    def __init__(self):
        self.db = {'summary_reviews': [], 'summary_comments': [], 'users': [dict(AGENT), dict(OTHER), dict(ADMIN)]}

    def table(self, name):
        return FakeQuery(self.db, name)


@pytest.fixture
def db(monkeypatch):
    sb = FakeSupabase()
    monkeypatch.setattr(summary_feedback, 'get_supabase_client', lambda: sb)
    return sb


@pytest.fixture
def client(monkeypatch, db):
    users = {u['email']: u for u in (AGENT, OTHER, ADMIN)}
    monkeypatch.setattr(routes, 'verify_supabase_token',
                        lambda token: {'sub': 'uid-' + token, 'email': token} if token in users else None)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email', lambda email: dict(users[email]) if email in users else None)
    monkeypatch.setattr(routes.user_helpers, 'is_admin', lambda email=None, auth_user_id=None: email == ADMIN['email'])
    return flask_app.test_client()


def auth(user):
    return {'Authorization': f"Bearer {user['email']}"}


def quote_of(text):
    start = SUMMARY.index(text)
    return {'quote': text, 'quote_start': start, 'quote_end': start + len(text)}


def review(client, user=AGENT, comments=None, summary=SUMMARY):
    return client.post('/summary-reviews', headers=auth(user),
                       json={'template_name': 'Brochure.zip', 'summary': summary, 'comments': comments or []})


# ---- Saving reviews ----

def test_review_without_comments_is_saved_as_no_feedback(client, db):
    r = review(client)
    assert r.status_code == 201
    assert r.get_json()['outcome'] == 'no_feedback'
    [saved] = db.db['summary_reviews']
    assert saved['user_id'] == AGENT['id'] and saved['summary'] == SUMMARY
    assert db.db['summary_comments'] == []


def test_review_with_quoted_section_and_general_comments(client, db):
    r = review(client, comments=[
        {'section_key': 'intro', **quote_of('2 things'), 'body': '  Too vague.  '},
        {'section_key': 'FONTS_INCLUDED', 'section_title': 'Fonts missing', 'body': 'Mention .ttc files.'},
        {'section_key': 'general', 'body': 'Reads well overall.'},
    ])
    assert r.status_code == 201
    body = r.get_json()
    assert body['outcome'] == 'feedback'
    assert [c['body'] for c in body['comments']] == ['Too vague.', 'Mention .ttc files.', 'Reads well overall.']
    assert body['comments'][0]['quote'] == '2 things'
    assert all(c['review_id'] == body['id'] for c in db.db['summary_comments'])
    assert all(c['user_id'] == AGENT['id'] for c in db.db['summary_comments'])


@pytest.mark.parametrize('comment, message', [
    ({'section_key': 'intro', 'body': ''}, 'Comment is required'),
    ({'section_key': 'bad key!', 'body': 'x'}, 'valid section_key'),
    ({'section_key': 'intro', 'body': 'x' * 2001}, '2000 characters'),
    ({'section_key': 'intro', 'body': 'x', 'quote': 'not in the summary', 'quote_start': 0, 'quote_end': 18},
     "doesn't match"),
    ({'section_key': 'intro', 'body': 'x', 'quote': '2 things', 'quote_start': 0, 'quote_end': 8}, "doesn't match"),
    ({'section_key': 'intro', 'body': 'x', 'quote': '2 things', 'quote_start': '5', 'quote_end': 13}, "doesn't match"),
])
def test_invalid_comments_are_rejected_with_a_clear_message(client, db, comment, message):
    r = review(client, comments=[comment])
    assert r.status_code == 400
    assert message in r.get_json()['error']['message']
    assert db.db['summary_reviews'] == []


def test_review_needs_a_summary_and_a_template_name(client, db):
    assert review(client, summary='').status_code == 400
    r = client.post('/summary-reviews', headers=auth(AGENT), json={'summary': SUMMARY})
    assert r.status_code == 400


def test_too_many_comments_are_rejected(client, db):
    comments = [{'section_key': 'general', 'body': 'x'}] * (summary_feedback.MAX_COMMENTS + 1)
    assert review(client, comments=comments).status_code == 400


def test_reviewing_requires_sign_in_and_an_approved_user(client, monkeypatch):
    assert client.post('/summary-reviews', json={}).status_code == 401
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email', lambda email: None)
    assert review(client).status_code == 403


# ---- Who can read feedback ----

def test_agents_only_see_their_own_comments(client, db):
    review(client, AGENT, [{'section_key': 'general', 'body': 'Mine'}])
    review(client, OTHER, [{'section_key': 'general', 'body': 'Not mine'}])
    r = client.get('/summary-reviews/mine', headers=auth(AGENT))
    assert r.status_code == 200
    rows = r.get_json()
    assert [c['body'] for c in rows] == ['Mine']
    assert rows[0]['template_name'] == 'Brochure.zip' and rows[0]['summary'] == SUMMARY
    assert 'user_email' not in rows[0]


def test_only_admins_can_list_all_feedback(client, db):
    review(client, AGENT, [{'section_key': 'general', 'body': 'Hi'}])
    assert client.get('/admin/summary-feedback', headers=auth(AGENT)).status_code == 403
    r = client.get('/admin/summary-feedback', headers=auth(ADMIN))
    assert r.status_code == 200
    [comment] = r.get_json()['comments']
    assert comment['user_email'] == AGENT['email'] and comment['template_name'] == 'Brochure.zip'


def test_admin_list_counts_reviews_with_and_without_feedback(client, db):
    review(client)
    review(client)
    review(client, comments=[{'section_key': 'general', 'body': 'x'}])
    stats = client.get('/admin/summary-feedback', headers=auth(ADMIN)).get_json()['stats']
    assert stats == {'reviews': 3, 'with_feedback': 1, 'no_feedback': 2}


# ---- Resolving ----

def test_admins_resolve_and_reopen_comments_and_filter_by_status(client, db):
    review(client, comments=[{'section_key': 'general', 'body': 'A'}, {'section_key': 'general', 'body': 'B'}])
    a, b = db.db['summary_comments']

    r = client.patch(f"/admin/summary-feedback/{a['id']}", headers=auth(ADMIN), json={'resolved': True})
    assert r.status_code == 200 and r.get_json()['resolved_at']
    assert a['resolved_by'] == ADMIN['id']

    def bodies(status):
        res = client.get(f'/admin/summary-feedback?status={status}', headers=auth(ADMIN)).get_json()
        return sorted(c['body'] for c in res['comments'])
    assert bodies('open') == ['B']
    assert bodies('resolved') == ['A']
    assert bodies('all') == ['A', 'B']

    client.patch(f"/admin/summary-feedback/{a['id']}", headers=auth(ADMIN), json={'resolved': False})
    assert a['resolved_at'] is None and bodies('open') == ['A', 'B']


def test_agents_see_when_their_comment_was_resolved(client, db):
    review(client, comments=[{'section_key': 'general', 'body': 'A'}])
    [c] = db.db['summary_comments']
    client.patch(f"/admin/summary-feedback/{c['id']}", headers=auth(ADMIN), json={'resolved': True})
    [mine] = client.get('/summary-reviews/mine', headers=auth(AGENT)).get_json()
    assert mine['resolved_at']


def test_resolving_is_admin_only_and_validated(client, db):
    review(client, comments=[{'section_key': 'general', 'body': 'A'}])
    [c] = db.db['summary_comments']
    assert client.patch(f"/admin/summary-feedback/{c['id']}", headers=auth(AGENT), json={'resolved': True}).status_code == 403
    assert client.patch(f"/admin/summary-feedback/{c['id']}", headers=auth(ADMIN), json={'resolved': 'yes'}).status_code == 400
    assert client.patch('/admin/summary-feedback/not-a-uuid', headers=auth(ADMIN), json={'resolved': True}).status_code == 404
    assert client.patch(f'/admin/summary-feedback/{uuid.uuid4()}', headers=auth(ADMIN), json={'resolved': True}).status_code == 404


def test_bad_status_filter_is_a_400(client, db):
    assert client.get('/admin/summary-feedback?status=nope', headers=auth(ADMIN)).status_code == 400


def test_database_errors_are_a_generic_500(client, db, monkeypatch):
    def boom():
        raise RuntimeError('relation "summary_reviews" does not exist')
    monkeypatch.setattr(summary_feedback, 'get_supabase_client', boom)
    r = review(client)
    assert r.status_code == 500
    assert 'relation' not in r.get_data(as_text=True)
