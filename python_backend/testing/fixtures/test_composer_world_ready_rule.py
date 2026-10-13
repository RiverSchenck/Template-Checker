"""Composer: Frontify writes edited text back with a single-line composer, keeping World-Ready Single-line
as it is (Idml.php getTextComposer). Only paragraph composers are a warning (docs/rules-review-2026-10-12.md)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def composer_warnings(tmp_path, composer):
    pkg = PackageBuilder()
    pkg.paragraph_style('Body', Composer=composer)
    pkg.text_frame(pkg.story([('Body', 'Text')]))
    return run_checker(pkg.write(tmp_path)).of('COMPOSER')


@pytest.mark.parametrize('composer', ['HL Single', 'HL Single Optyca'])
def test_single_line_composers_are_fine(tmp_path, composer):
    assert composer_warnings(tmp_path, composer) == []


@pytest.mark.parametrize('composer', ['HL Composer', 'HL Composer Optyca'])
def test_paragraph_composers_are_a_warning(tmp_path, composer):
    assert [i.severity for i in composer_warnings(tmp_path, composer)] == ['warning']
