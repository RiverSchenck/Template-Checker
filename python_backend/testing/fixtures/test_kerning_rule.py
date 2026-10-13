"""Kerning: Frontify always uses Metrics kerning. A paragraph style (KERNING) or character style (KERNING_CHAR)
with other kerning, set on it or inherited through BasedOn, is an error. Kerning set directly on text is an
override, reported by the overrides check instead."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def kerning_issues(tmp_path, paragraph_styles=(), character_styles=(), runs=None):
    pkg = PackageBuilder()
    for name, based_on, attrs in paragraph_styles:
        pkg.paragraph_style(name, based_on, **attrs)
    for name, based_on, attrs in character_styles:
        pkg.character_style(name, based_on, **attrs)
    runs = runs or [('Hello ', {}), ('world', {'AppliedCharacterStyle': 'CharacterStyle/Emphasis'})]
    pkg.text_frame(pkg.story([('Heading', runs)]))
    run = run_checker(pkg.write(tmp_path))
    return [(i.severity, i.classifier, i.identifier, i.context) for i in run.issues
            if i.classifier in ('KERNING', 'KERNING_CHAR')]


def test_paragraph_style_with_optical_kerning(tmp_path):
    assert kerning_issues(tmp_path, [('Heading', None, {'KerningMethod': '$ID/Optical'})],
                          [('Emphasis', None, {})]) == [('errors', 'KERNING', 'Heading', '')]


def test_paragraph_style_kerning_inherited_through_based_on(tmp_path):
    assert kerning_issues(tmp_path, [('Base', None, {'KerningMethod': '$ID/Optical'}), ('Heading', 'Base', {})],
                          [('Emphasis', None, {})]) == \
        [('errors', 'KERNING', 'Heading', 'Inherited from: ParagraphStyle/Base')]


def test_character_style_with_optical_kerning(tmp_path):
    assert kerning_issues(tmp_path, [('Heading', None, {})],
                          [('Emphasis', None, {'KerningMethod': '$ID/Optical'})]) == \
        [('errors', 'KERNING_CHAR', 'Emphasis', '')]


def test_character_style_kerning_inherited_through_based_on(tmp_path):
    assert kerning_issues(tmp_path, [('Heading', None, {})],
                          [('Base', None, {'KerningMethod': '$ID/Optical'}), ('Emphasis', 'Base', {})]) == \
        [('errors', 'KERNING_CHAR', 'Emphasis', 'Inherited from: CharacterStyle/Base')]


def test_metrics_kerning_is_fine(tmp_path):
    assert kerning_issues(tmp_path, [('Heading', None, {'KerningMethod': '$ID/Metrics'})],
                          [('Emphasis', None, {'KerningMethod': '$ID/Metrics'})]) == []


def test_kerning_on_text_is_left_to_the_overrides_check(tmp_path):
    assert kerning_issues(tmp_path, [('Heading', None, {})], [('Emphasis', None, {})],
                          runs=[('Hello', {'KerningMethod': '$ID/Optical'})]) == []
