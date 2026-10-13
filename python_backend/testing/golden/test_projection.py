from collections import Counter

from testing.golden.golden import load, packages
from testing.golden.projection import ProjectedIssue, diff, main, project


def item(classifier, data_id='u1', page_id='p1', context='', **extra):
    return {'validationClassifier': classifier, 'data_id': data_id, 'page_id': page_id, 'page_name': '1',
            'spread_id': 's1', 'context': context, 'identifier': 'ignored', 'bounds': {'x': 1}, **extra}


def results(category, identifier, severity, *items):
    return {category: {'details': {identifier: {'errors': [], 'warnings': [], 'infos': [], severity: list(items)}}}}


def test_issue_fields():
    issues = project(results('par_styles', 'H4', 'errors',
                             item('KERNING', 'u9', 'p2', 'Inherited from: ParagraphStyle/Base',
                                  context_details={'b': 2, 'a': 1}, text_content=['Hello'])))
    assert issues == Counter({ProjectedIssue('error', 'KERNING', 'H4', 'u9', 'p2', '{"a": 1, "b": 2}',
                                             'Inherited from: ParagraphStyle/Base'): 1})


def test_merged_v1_keys_project_onto_one_check():
    checks = {next(iter(project(results('images', 'x', 'errors', item(key))))).check
              for key in ('IMAGE_TRANSFORMATION_IMAGE', 'IMAGE_TRANSFORMATION_CONTAINER', 'PAGE_ITEM_TRANSFORMATION')}
    assert checks == {'TRANSFORMATION'}
    assert next(iter(project(results('text_boxes', 'x', 'errors', item('PARAGRAPH_STYLE_TEXT_BOX'))))).check == 'PARAGRAPH_STYLE'
    assert next(iter(project(results('general', 'x', 'errors', item('KERNING_CHAR'))))).check == 'KERNING_CHAR'


def test_severities_and_missing_ids():
    issue, = project(results('general', 'doc', 'warnings', item('DOCUMENT_BLEED', data_id=None, page_id='')))
    assert (issue.severity, issue.item_id, issue.page_id, issue.facts) == ('warning', '', '', '')


def test_repeated_issue_is_counted_and_diffed():
    once = project(results('text_boxes', 'u1', 'infos', item('EMPTY_TEXT_FRAME')))
    twice = project(results('text_boxes', 'u1', 'infos', item('EMPTY_TEXT_FRAME'), item('EMPTY_TEXT_FRAME')))
    assert sum(twice.values()) == 2
    assert diff(once, twice) == ([], list(once))
    assert diff(twice, once) == (list(once), [])


def test_order_and_display_fields_dont_matter():
    a = results('par_styles', 'Body', 'errors', item('COMPOSER', 'u1'), item('COMPOSER', 'u2'))
    b = results('par_styles', 'Body', 'errors', item('COMPOSER', 'u2', bounds={'x': 9}), item('COMPOSER', 'u1'))
    assert diff(project(a), project(b)) == ([], [])


def test_every_issue_in_every_golden_is_projected():
    for package in packages():
        data = load(package)['results']
        items = sum(len(items) for cat in ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')
                    for by_severity in data[cat]['details'].values() for items in by_severity.values())
        assert sum(project(data).values()) == items, package


def test_cli_reports_no_change_for_an_unchanged_package(capsys):
    package = next(p for p in packages() if 'kerning_check/fail_data' in p)
    assert main([package]) == 0
    assert '0 package(s) with changed issues: +0 -0' in capsys.readouterr().out
