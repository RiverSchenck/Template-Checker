"""Results v2 (plan §4.3): subjects, facts and the committed schema. The goldens pin v2 for every corpus package;
these cover what the corpus has no issue for, and the contract itself."""
import os

from src.pipeline.run import run
from src.pipeline.workspace import run_workspace
from src.results import catalogue
from src.results.models import SCHEMA_PATH, Results, schema_json
from src.results.serialize import results_v2
from testing.fixtures.idml_builder import PackageBuilder
from testing.golden.golden import load, packages

FLIP = '-1 0 0 1 0 -396'


def check(package_path: str) -> dict:
    with run_workspace() as workspace:
        outcome = run(package_path, workspace, previews=False)
    results = results_v2(outcome.results, outcome.layout, template_name=outcome.template_name, totals=outcome.totals)
    Results.model_validate(results)
    for issue in results['issues']:
        entry = catalogue.BY_KEY[issue['check']]
        assert issue['subject']['kind'] in entry.subject_kinds, issue
        if issue['facts'] is not None:
            entry.facts.model_validate(issue['facts'])
    return results


def subjects(results: dict, check_key: str) -> list:
    return [issue['subject'] for issue in results['issues'] if issue['check'] == check_key]


def test_subjects_of_style_frame_image_and_item_checks(tmp_path):
    pkg = PackageBuilder()
    pkg.paragraph_style('Tinted', None, FillTint='50')
    pkg.character_style('Loose', None, KerningMethod='Optical')
    pkg.character_style('Sup', None, Position='Superscript')
    frame = pkg.text_frame(pkg.story([('Tinted', [('Hello', {'AppliedCharacterStyle': 'CharacterStyle/Loose'}),
                                                  ('TM', {'AppliedCharacterStyle': 'CharacterStyle/Sup'})])]),
                           wrap='BoundingBoxTextWrap')
    oval = pkg.shape('Oval', wrap='Contour', transform=FLIP)
    image_frame = pkg.image('photo.jpg', frame_transform=FLIP, image_transform='-1 0 0 1 0 0')
    results = check(pkg.write(tmp_path))

    assert subjects(results, 'FILL_TINT') == [
        {'kind': 'paragraph_style', 'id': 'ParagraphStyle/Tinted', 'name': 'Tinted'}]
    assert subjects(results, 'KERNING_CHAR') == [
        {'kind': 'character_style', 'id': 'CharacterStyle/Loose', 'name': 'Loose'}]
    assert subjects(results, 'TEXT_POSITION') == [
        {'kind': 'character_style', 'id': 'CharacterStyle/Sup', 'name': 'Sup'}]
    assert subjects(results, 'TEXT_WRAP') == [{'kind': 'text_frame', 'id': frame, 'name': None},
                                              {'kind': 'page_item', 'id': oval, 'name': 'Oval'}]
    assert sorted(subjects(results, 'TRANSFORMATION'), key=lambda s: s['kind']) == [
        {'kind': 'image', 'id': 'photo.jpg', 'name': 'photo.jpg'},
        {'kind': 'image_frame', 'id': image_frame, 'name': 'photo.jpg'},
        {'kind': 'page_item', 'id': oval, 'name': 'Oval'}]
    position, = [i for i in results['issues'] if i['check'] == 'TEXT_POSITION']
    assert position['facts'] == {'inherited_from': 'CharacterStyle/Sup'}
    assert position['text'] == ['TM']
    assert results['text_boxes'][frame]['content'] == 'HelloTM\n'


def test_document_issues_and_empty_fields_are_null(tmp_path):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'x')]))
    pkg.bleed = '9'
    bleed, = [i for i in check(pkg.write(tmp_path))['issues'] if i['check'] == 'DOCUMENT_BLEED']
    assert bleed['subject'] == {'kind': 'document', 'id': None, 'name': None}
    assert bleed['location'] == {'page_id': None, 'page_name': None, 'spread_id': None, 'item_id': None,
                                 'bounds': None}
    assert (bleed['severity'], bleed['text']) == ('warning', None)
    assert bleed['facts'] == {'bleed': {'top': 9.0, 'bottom': 9.0, 'inside': 9.0, 'outside': 9.0}}


def test_every_check_is_listed_with_its_steps_per_subject_kind(tmp_path):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'x')]))
    checks = {c['key']: c for c in check(pkg.write(tmp_path))['checks']}
    assert list(checks) == [entry.key for entry in catalogue.ENTRIES]
    assert checks['OBJECT_STYLE']['fix'] == {kind: list(catalogue.BY_KEY['OBJECT_STYLE'].fix_for(kind))
                                             for kind in ('text_frame', 'image')}
    assert checks['ZIP']['is_check'] is False and checks['KERNING']['severity'] == 'error'


def test_committed_schema_is_up_to_date():
    with open(SCHEMA_PATH, encoding='utf-8') as f:
        assert f.read() == schema_json(), 'run: python -m src.results.models'


def test_every_golden_validates():
    for package in packages():
        results = load(package)['results']
        Results.model_validate(results)
        for issue in results['issues']:
            entry = catalogue.BY_KEY[issue['check']]
            assert issue['subject']['kind'] in entry.subject_kinds, (package, issue)
            assert (issue['facts'] is None) or entry.facts.model_validate(issue['facts']), (package, issue)
