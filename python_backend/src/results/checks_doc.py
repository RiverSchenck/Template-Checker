"""docs/checks.md: every check, written out from the catalogue (the only copy of the wording).

    python -m src.results.checks_doc    # rewrite docs/checks.md after the catalogue changes

testing/unit_tests/results/test_checks_doc.py fails while the committed page is out of date.
"""
import os
from typing import List

from src.results.catalogue import ENTRIES, Entry

DOC_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'docs', 'checks.md')

KINDS = {'paragraph_style': 'paragraph style', 'character_style': 'character style', 'text_frame': 'text frame',
         'image': 'image', 'image_frame': 'image frame', 'font': 'font', 'page_item': 'page item',
         'document': 'document'}
GROUPS = [('error', 'Blocker', 'Break the template, or will very likely make it look different.'),
          ('warning', 'Warning', 'May make the template look different than expected.'),
          ('info', 'Info', 'A heads up: worth a check, but often fine.')]
LEVEL = {severity: name for severity, name, _ in GROUPS}

INTRO = '''# Checks

Every check the Template Checker runs on an InDesign package, with the wording the web app, the customer summary
and analytics show. Generated from the catalogue
([`python_backend/src/results/catalogue.py`](../python_backend/src/results/catalogue.py)); don't edit it by hand:
change the catalogue and run `python -m src.results.checks_doc` in `python_backend`. Why each rule exists, and how
Frontify behaves, is in [checker-rules.md](checker-rules.md).
'''

ADDING = '''## Adding a check

1. Write the check in the `src/checks/` module for its theme and register it (`src/checks/__init__.py` says how).
2. Add its entry to the catalogue (`src/results/catalogue.py`): key, severity, what it's about, title, why, fix steps
   and help article, and the facts model its issues record (`src/results/facts.py`), if any.
3. Report it from the check by its key, with the subject it's about: `report(results, 'MY_CHECK', ...,
   subject=...)`, or the `at_*` helpers in `src/checks/_report.py`.
4. Regenerate what's built from the catalogue and the results, in this order, and review each diff:
   - in `python_backend`: `python -m src.results.checks_doc` (this page), `python -m src.results.models`
     (`schema/results-v2.json`), `python -m testing.golden --update` and
     `UPDATE_SUMMARY_GOLDENS=1 pytest testing/unit_tests/customer_summary/test_summary_goldens.py`;
   - in `react-frontend`: `npm run types` and `npm run fixtures`.
'''


def _kinds(entry: Entry) -> str:
    return ', '.join(KINDS[kind] for kind in entry.subject_kinds)


def _fix(entry: Entry) -> List[str]:
    steps = {kind: entry.fix_for(kind) for kind in entry.subject_kinds}
    if len(set(steps.values())) <= 1:
        return [f'- {step}' for step in next(iter(steps.values()), ())]
    return [line for kind, kind_steps in steps.items()
            for line in [f'- For {KINDS[kind]}s:', *(f'  - {step}' for step in kind_steps)]]


def _facts(entry: Entry) -> List[str]:
    if entry.facts is None:
        return []
    fields = [f'`{name}`' + (f' ({field.description.rstrip(".")})' if field.description else '')
              for name, field in entry.facts.model_fields.items()]
    return [f'**Facts:** {", ".join(fields)}.', '']


def _check(entry: Entry) -> List[str]:
    lines = [f'### {entry.title}', '', f'`{entry.key}` · About: {_kinds(entry)}', '', entry.why, '']
    fix = _fix(entry)
    if fix:
        lines += ['**Fix in InDesign:**', '', *fix, '']
    lines += _facts(entry)
    if entry.help_article:
        lines += [f'[Help article]({entry.help_article})', '']
    return lines


def render() -> str:
    checks = [entry for entry in ENTRIES if entry.is_check]
    lines = [INTRO, '| Check | Severity | About | Title |', '|---|---|---|---|']
    lines += [f'| `{e.key}` | {LEVEL[e.severity]} | {_kinds(e)} | {e.title} |' for e in checks]
    lines.append('')
    for severity, heading, meaning in GROUPS:
        lines += [f'## {heading}s', '', meaning, '']
        for entry in checks:
            if entry.severity == severity:
                lines += _check(entry)
    failures = ', '.join(f'`{e.key}`' for e in ENTRIES if not e.is_check)
    lines += ['## Package and parsing failures', '',
              f'Reported when a package can\'t be checked ({failures}); the issue\'s detail says why. They aren\'t '
              'listed among the checks a template passed.', '', ADDING]
    return '\n'.join(lines).rstrip() + '\n'


if __name__ == '__main__':
    with open(DOC_PATH, 'w', encoding='utf-8') as f:
        f.write(render())
