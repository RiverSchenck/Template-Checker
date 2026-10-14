from collections import Counter

from testing.golden.golden import load, packages
from testing.golden.projection import ProjectedIssue, diff, main, project


def issue(check, kind, subject_id, item_id=None, page_id=None, facts=None, note=None, severity='error'):
    return {'check': check, 'severity': severity, 'subject': {'kind': kind, 'id': subject_id, 'name': 'shown'},
            'location': {'page_id': page_id, 'page_name': '1', 'spread_id': 's1', 'item_id': item_id, 'bounds': None},
            'facts': facts, 'text': ['ignored'], 'note': note}


def results(*issues):
    return {'schema_version': 2, 'issues': list(issues)}


def test_issue_fields():
    projected = project(results(issue('KERNING', 'paragraph_style', 'ParagraphStyle/H4', 'u9', 'p2', {'b': 2, 'a': 1},
                                      'set in “Base”')))
    assert projected == Counter({ProjectedIssue('error', 'KERNING', 'H4', 'u9', 'p2', '{"a": 1, "b": 2}',
                                                'set in “Base”'): 1})


def test_repeated_issue_is_counted_and_diffed():
    once = project(results(issue('EMPTY_TEXT_FRAME', 'text_frame', 'u1', 'u1', 'p1', severity='info')))
    twice = project(results(*[issue('EMPTY_TEXT_FRAME', 'text_frame', 'u1', 'u1', 'p1', severity='info')] * 2))
    assert sum(twice.values()) == 2
    assert diff(once, twice) == ([], list(once))
    assert diff(twice, once) == (list(once), [])


def test_every_issue_in_every_golden_is_projected():
    for package in packages():
        data = load(package)['results']
        assert sum(project(data).values()) == len(data['issues']), package


def test_cli_reports_no_change_for_an_unchanged_package(capsys):
    package = '1 large image.zip'  # (it has kerning issues)
    assert main([package]) == 0
    assert '0 package(s) with changed issues: +0 -0' in capsys.readouterr().out
