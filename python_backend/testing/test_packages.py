"""Every test package against what it's expected to show (testing/packages/expected.py), on a full run.

The goldens (testing/golden) pin every detail of every result; this table says what matters about each package, and
why, so a change in what the checker finds reads as a change here.

- CHECKS: per package, the issues of the checks the package exists to test, one entry each, as describe() writes
  them. Other checks' issues in the same package aren't compared.
- ALL_ISSUES: per package, how many issues of each check the whole run finds; every check is compared.

A package can have a row in both; a package in neither table fails: every package needs a row.
"""
from collections import Counter

import pytest

from src.pipeline.run import run
from src.pipeline.workspace import run_workspace
from testing.golden.golden import package_path, packages
from testing.packages.expected import ALL_ISSUES, CHECKS

# The fact that tells two issues of a check apart, shown after the subject.
KEY_FACTS = {'TRANSFORMATION': 'kind', 'AUTO_SIZE_TEXT_BOX': 'auto_size'}


def describe(issue: dict) -> str:
    """An issue as the table lists it: 'subject @ page (key fact)', e.g. 'H4 @ 1' or 'logo.png @ 2 (flip)'.
    The subject is its name (style, font, file), a frame's id, or a page item's kind and id."""
    subject, page = issue['subject'], issue['location']['page_name']
    if subject['kind'] == 'page_item':
        text = f"{subject['name']} {subject['id']}"
    else:
        text = subject['name'] or subject['id'] or subject['kind']
    if page:
        text += f' @ {page}'
    fact = KEY_FACTS.get(issue['check'])
    if fact and (issue['facts'] or {}).get(fact):
        text += f" ({issue['facts'][fact]})"
    return text


def results(package: str) -> dict:
    with run_workspace() as workspace:
        return run(package_path(package), workspace, previews=False).json()


def test_every_package_has_a_row():
    assert sorted(CHECKS.keys() | ALL_ISSUES.keys()) == packages(), 'add a row to testing/packages/expected.py'


@pytest.mark.parametrize('package', sorted(CHECKS))
def test_checks(package):
    issues = results(package)['issues']
    for check, expected in CHECKS[package].items():
        actual = sorted(describe(i) for i in issues if i['check'] == check)
        assert actual == sorted(expected), check


@pytest.mark.parametrize('package', sorted(ALL_ISSUES))
def test_all_issues(package):
    assert dict(Counter(i['check'] for i in results(package)['issues'])) == ALL_ISSUES[package]
