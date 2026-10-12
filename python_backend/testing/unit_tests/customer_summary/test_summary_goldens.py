"""The customer summary for every golden checker result, stored so wording changes show up as a reviewable diff.

Expected output: testing/golden/summaries, one file per golden result (testing/golden/results) plus hand-built edge
cases (testing/golden/summary_cases). After a deliberate change to the wording or to the checker's results:

    UPDATE_SUMMARY_GOLDENS=1 pytest testing/unit_tests/customer_summary/test_summary_goldens.py

then review the diff in testing/golden/summaries: it's exactly what customers will see differently.
"""
import json
import os

import pytest

from app.customer_summary import build_customer_summary

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'golden')
RESULTS_DIR = os.path.join(GOLDEN_DIR, 'results')
# Hand-built results for edge cases the test packages don't cover (key order, Unicode, rounding, odd pages).
CASES_DIR = os.path.join(GOLDEN_DIR, 'summary_cases')
SUMMARIES_DIR = os.path.join(GOLDEN_DIR, 'summaries')
UPDATE = bool(os.environ.get('UPDATE_SUMMARY_GOLDENS'))


def _inputs(directory, prefix=''):
    """(name of the expected summary, path of the checker result it's built from) for every JSON file."""
    found = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith('.json'):
                path = os.path.join(root, f)
                found.append((os.path.join(prefix, os.path.relpath(path, directory)), path))
    return sorted(found)


INPUTS = dict(_inputs(RESULTS_DIR) + _inputs(CASES_DIR, 'summary_cases'))


def test_every_golden_result_has_an_expected_summary():
    assert INPUTS
    missing = [p for p in INPUTS if not os.path.exists(os.path.join(SUMMARIES_DIR, p))]
    assert UPDATE or not missing, f'Missing expected summaries; run with UPDATE_SUMMARY_GOLDENS=1: {missing[:5]}'


@pytest.mark.parametrize('package', sorted(INPUTS))
def test_summary_matches_golden(package):
    with open(INPUTS[package], encoding='utf-8') as f:
        summary = build_customer_summary(json.load(f)['results'])
    actual = {'text': summary.review_text, 'html': summary.html, 'plain_text': summary.plain_text}

    path = os.path.join(SUMMARIES_DIR, package)
    if UPDATE:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(json.dumps(actual, ensure_ascii=False, indent=2) + '\n')
        return
    with open(path, encoding='utf-8') as f:
        assert actual == json.load(f)
