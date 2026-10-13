"""Fill tint: Frontify shows text colours untinted, from paragraph and character styles alike. A character
style with a tint is an error once per style (docs/rules-review-2026-10-12.md)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def tint_issues(tmp_path, *char_styles, runs=None):
    pkg = PackageBuilder()
    for name, based_on, attrs in char_styles:
        pkg.character_style(name, based_on, **attrs)
    runs = runs or [('Grey ', {'AppliedCharacterStyle': 'CharacterStyle/Caption'}),
                    ('again', {'AppliedCharacterStyle': 'CharacterStyle/Caption'})]
    pkg.text_frame(pkg.story([('Body', runs), ('Body', [('More grey', {'AppliedCharacterStyle': 'CharacterStyle/Caption'})])]))
    run = run_checker(pkg.write(tmp_path))
    return run.of('FILL_TINT_CHAR'), run.of('FILL_TINT')


def test_character_style_tint_is_reported_once(tmp_path):
    char, par = tint_issues(tmp_path, ('Caption', None, {'FillTint': '60'}))
    assert [(i.severity, i.identifier, i.context) for i in char] == [('errors', 'Caption', 'Fill Tint is: 60')]
    assert par == []


def test_tint_inherited_through_based_on(tmp_path):
    char, _ = tint_issues(tmp_path, ('Base', None, {'FillTint': '40'}), ('Caption', 'Base', {}))
    assert [i.context for i in char] == ['Fill Tint is: 40; Inherited from: CharacterStyle/Base']


@pytest.mark.parametrize('tint', ['100', '-1'])
def test_full_strength_is_fine(tmp_path, tint):
    assert tint_issues(tmp_path, ('Caption', None, {'FillTint': tint})) == ([], [])


def test_character_style_without_tint_is_fine(tmp_path):
    assert tint_issues(tmp_path, ('Caption', None, {})) == ([], [])
