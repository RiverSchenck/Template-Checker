import os
import shutil

import pytest

DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'data')


@pytest.fixture(scope='session', autouse=True)
def cleanup_unzipped_test_data():
    """Remove the folders FrontifyChecker unzips into src/data during the test run (they can add up to GBs)."""
    before = set(os.listdir(DATA_FOLDER)) if os.path.isdir(DATA_FOLDER) else set()
    yield
    if not os.path.isdir(DATA_FOLDER):
        return
    for name in set(os.listdir(DATA_FOLDER)) - before:
        path = os.path.join(DATA_FOLDER, name)
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)


@pytest.fixture(autouse=True)
def isolated_rate_limit_state(tmp_path, monkeypatch):
    """Give every test its own rate-limit state so counts and locks never leak between tests."""
    import app.rate_limit as rate_limit
    monkeypatch.setattr(rate_limit, 'STATE_DIR', str(tmp_path / 'rate-limit'))
