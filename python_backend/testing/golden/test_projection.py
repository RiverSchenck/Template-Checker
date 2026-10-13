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


def v2_issue(check, kind, subject_id, item_id=None, page_id=None, facts=None, detail=None, severity='error'):
    return {'check': check, 'severity': severity, 'subject': {'kind': kind, 'id': subject_id, 'name': 'shown'},
            'location': {'page_id': page_id, 'page_name': '1', 'spread_id': 's1', 'item_id': item_id, 'bounds': None},
            'facts': facts, 'text': ['ignored'], 'detail': detail}


def test_v2_projects_like_v1():
    pairs = [
        # A style: v1 named it by its short id, v2 by its Self.
        (results('par_styles', '[No paragraph style]', 'errors',
                 item('KERNING', 'u9', 'p2', 'Inherited from: X', context_details={'inheritedFrom': 'X'})),
         v2_issue('KERNING', 'paragraph_style', 'ParagraphStyle/$ID/[No paragraph style]', 'u9', 'p2',
                  {'inherited_from': 'X'}, 'Inherited from: X')),
        # A text frame: v1 grouped by story (or by the unstyled text's style), v2 by the frame.
        (results('text_boxes', 'NormalParagraphStyle', 'errors', item('PARAGRAPH_STYLE', 'u5')),
         v2_issue('PARAGRAPH_STYLE', 'text_frame', 'u5', 'u5', 'p1')),
        (results('images', 'logo.png', 'errors', item('IMAGE_TRANSFORMATION_CONTAINER', 'u7')),
         v2_issue('TRANSFORMATION', 'image_frame', 'u7', 'u7', 'p1')),
        # A page item: v1 identified it as 'Kind:Self'.
        (results('general', 'Oval:u3', 'errors', item('TEXT_WRAP_ITEM', 'u3')),
         v2_issue('TEXT_WRAP', 'page_item', 'u3', 'u3', 'p1')),
        # The document: v1 'null', v2 no id; no item, no page.
        (results('general', 'null', 'warnings', item('DOCUMENT_BLEED', data_id='null', page_id='')),
         v2_issue('DOCUMENT_BLEED', 'document', None, severity='warning')),
    ]
    for v1, v2 in pairs:
        assert project(v1) == project({'schema_version': 2, 'issues': [v2]}), v2['check']


def test_cli_reports_no_change_for_an_unchanged_package(capsys):
    package = next(p for p in packages() if 'kerning_check/fail_data' in p)
    assert main([package]) == 0
    assert '0 package(s) with changed issues: +0 -0' in capsys.readouterr().out
