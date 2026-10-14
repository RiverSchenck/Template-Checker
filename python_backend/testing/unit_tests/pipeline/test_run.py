"""src/pipeline/run.py: a check run stage by stage, and page previews only where they're shown (plan PR 3.2, D6)."""
import copy
import io
import os

import pytest

import app.routes as routes
import app.utils as utils
import src.pipeline.run as pipeline_run
from app import rate_limit
from run import app as flask_app
from src.checks import CHECKS, Check
from src.checks.stages import States
from src.pipeline.run import StageTracker, run
from src.pipeline.workspace import run_workspace

TESTING_DIR = os.path.join(os.path.dirname(__file__), '..', '..')
BLANK = os.path.join(TESTING_DIR, 'packages', 'Blank.zip')  # one page, with a preview


def without_previews(results: dict) -> dict:
    results = copy.deepcopy(results)
    for page in results.get('pages', []):
        page['preview'] = None
    return results


def test_completed_run_with_and_without_previews():
    with run_workspace() as workspace:
        with_previews = run(BLANK, workspace, previews=True)
    with run_workspace() as workspace:
        plain = run(BLANK, workspace, previews=False)
    assert with_previews.completed and plain.completed and plain.stage == States.RESULTS
    assert [page['preview'] is not None for page in with_previews.json()['pages']] == [True]
    assert [page['preview'] for page in plain.json()['pages']] == [None]
    # Everything else is the same.
    assert without_previews(with_previews.json()) == plain.json()


def test_rejected_run_says_where_it_stopped(tmp_path):
    not_a_zip = tmp_path / 'brief.pdf'
    not_a_zip.write_bytes(b'%PDF')
    with run_workspace() as workspace:
        outcome = run(str(not_a_zip), workspace)
    assert (outcome.completed, outcome.stage) == (False, States.UNZIP_PACKAGE)
    assert [issue.check for issue in outcome.results] == ['ZIP']


def test_a_crashing_check_raises_with_its_stage():
    def crash(doc, results):
        raise KeyError('Self')
    tracker = StageTracker()
    checks = [Check(States.MASTERPAGE_CHECK, crash)] + list(CHECKS[1:])
    with run_workspace() as workspace, pytest.raises(KeyError):
        run(BLANK, workspace, checks=checks, tracker=tracker)
    assert tracker.stage == States.MASTERPAGE_CHECK


# --- which endpoints render previews --------------------------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(routes, 'verify_supabase_token',
                        lambda token: {'sub': 'uid-1', 'email': 'approved@example.com'} if token == 'valid' else None)
    monkeypatch.setattr(routes.user_helpers, 'get_user_by_email', lambda email: {'id': 'user-1', 'email': email})
    monkeypatch.setattr(rate_limit, 'acquire', lambda bucket: (bucket, 'lease-1'))
    monkeypatch.setattr(rate_limit, 'hit', lambda bucket, limit, window: (True, 0))
    monkeypatch.setattr(rate_limit, 'release', lambda handle: None)
    monkeypatch.setattr(utils, 'log_analytics_to_supabase', lambda **kwargs: 'run-1')
    rendered = []
    real = pipeline_run.page_previews
    monkeypatch.setattr(pipeline_run, 'page_previews', lambda *a: rendered.append(1) or real(*a))
    c = flask_app.test_client()
    c.rendered = rendered
    return c


@pytest.mark.parametrize('path, previews', [
    ('/v1/checks', False), ('/v1/checks?previews=1', True),
    ('/v1/checks/summary', False), ('/v1/checks/xml', False),
])
def test_previews_are_rendered_only_where_asked(client, path, previews):
    with open(BLANK, 'rb') as f:
        r = client.post(path, data={'file': (io.BytesIO(f.read()), 'Blank.zip')},
                        headers={'Authorization': 'Bearer valid'}, content_type='multipart/form-data')
    assert r.status_code == 200
    assert client.rendered == ([1] if previews else [])
    if path.startswith('/v1/checks') and 'summary' not in path and 'xml' not in path:
        pages = r.get_json()['results']['pages']
        assert [page['preview'] is not None for page in pages] == [previews]
