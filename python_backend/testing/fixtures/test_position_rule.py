"""Superscript/subscript and baseline shift: Frontify reads neither. Superscripts show full size on the
baseline (error); shifted text sits on the baseline (warning). Judged per text run on the value InDesign
applies, wherever it's set (docs/rules-review-2026-10-12.md)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

SUP = {'AppliedCharacterStyle': 'CharacterStyle/Sup'}


def position_issues(tmp_path, paragraphs, char_styles=(), paragraph_styles=()):
    pkg = PackageBuilder()
    for name, based_on, attrs in char_styles:
        pkg.character_style(name, based_on, **attrs)
    for name, based_on, attrs in paragraph_styles:
        pkg.paragraph_style(name, based_on, **attrs)
    pkg.text_frame(pkg.story(paragraphs))
    run = run_checker(pkg.write(tmp_path))
    return run.of('TEXT_POSITION'), run.of('BASELINE_SHIFT')


def test_superscript_from_character_style(tmp_path):
    position, shift = position_issues(tmp_path, [('Body', [('Brand', {}), ('®', SUP)])],
                                      char_styles=[('Sup', None, {'Position': 'Superscript'})])
    assert [(i.severity, i.identifier, i.context) for i in position] == [
        ('errors', 'Sup', 'Position is: Superscript; Inherited from: CharacterStyle/Sup')]
    assert shift == []


def test_superscript_through_based_on(tmp_path):
    position, _ = position_issues(tmp_path, [('Body', [('1', SUP)])],
                                  char_styles=[('Base', None, {'Position': 'OTSuperscript'}), ('Sup', 'Base', {})])
    assert [i.context for i in position] == ['Position is: OTSuperscript; Inherited from: CharacterStyle/Base']


def test_subscript_set_on_the_text(tmp_path):
    position, _ = position_issues(tmp_path, [('Body', [('CO', {}), ('2', {'Position': 'Subscript'})])])
    assert [i.context for i in position] == ['Position is: Subscript']


def test_subscript_from_paragraph_style(tmp_path):
    position, _ = position_issues(tmp_path, [('Small', 'Footnote text')],
                                  paragraph_styles=[('Small', None, {'Position': 'Subscript'})])
    assert [i.context for i in position] == ['Position is: Subscript; Inherited from: ParagraphStyle/Small']


def test_character_style_normal_overrides_paragraph(tmp_path):
    position, _ = position_issues(tmp_path, [('Small', [('Plain', {'AppliedCharacterStyle': 'CharacterStyle/Plain'})])],
                                  char_styles=[('Plain', None, {'Position': 'Normal'})],
                                  paragraph_styles=[('Small', None, {'Position': 'Superscript'})])
    assert position == []


def test_baseline_shift_is_a_warning(tmp_path):
    position, shift = position_issues(tmp_path, [('Body', [('Price', {}), ('€', {'BaselineShift': '3'})])])
    assert position == []
    assert [(i.severity, i.context) for i in shift] == [('warnings', 'Baseline Shift is: 3pt')]


@pytest.mark.parametrize('attrs', [{}, {'Position': 'Normal'}, {'BaselineShift': '0'}])
def test_normal_text_is_fine(tmp_path, attrs):
    assert position_issues(tmp_path, [('Body', [('Plain', attrs)])]) == ([], [])


def test_whitespace_only_runs_are_skipped(tmp_path):
    position, _ = position_issues(tmp_path, [('Body', [('Text', {}), (' ', SUP)])],
                                  char_styles=[('Sup', None, {'Position': 'Superscript'})])
    assert position == []
