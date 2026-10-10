"""Bugs found while planning the refactor (docs/PLAN-backend-refactor.md), pinned as strict expected failures.

Each fix in phase 1 makes its test pass, which fails the run until the marker is removed.
"""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


@pytest.mark.xfail(reason='B1: no MasterSpreads/ crashes masterpage_check', raises=AttributeError, strict=True)
def test_package_without_master_spreads_is_checked(tmp_path):
    pkg = PackageBuilder(master_spreads=False)
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    assert run_checker(pkg.write(tmp_path)).stopped_at == 'RESULTS'


@pytest.mark.xfail(reason="B5: issues get the spread's first page, not the item's page", strict=True)
def test_issue_on_right_hand_page_names_that_page(tmp_path):
    pkg = PackageBuilder(pages=2)
    pkg.text_frame(pkg.story([('Body', 'Right page')]), page=1, next='u999')
    [issue] = run_checker(pkg.write(tmp_path)).of('LINKED_TEXT_FRAME')
    assert (issue.page_id, issue.page_name) == ('page1', '2')
