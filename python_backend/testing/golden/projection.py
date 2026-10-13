"""Issue projection: a checker result reduced to the issues it reports, comparable across code versions.

Every behaviour PR proves its effect with this: the issues added and removed per package must be exactly the
ones it set out to change (docs/PLAN-v2-refactor.md §0.2, §6.6). Results v1 and v2 project onto the same tuples,
so goldens of either version compare with the current output (plan PR 5.2 proved v1 goldens == v2 output this way).

    python -m testing.golden.projection                      # stored goldens -> current code
    python -m testing.golden.projection --base origin/main   # goldens at a git ref -> current code
    python -m testing.golden.projection "1 large image.zip"     # only these packages (names in testing/packages/)

Goldens are keyed by package name since the corpus was deduplicated (plan PR 6.2): --base needs a ref from after it.
"""
import argparse
import json
import subprocess
import sys
from collections import Counter
from typing import NamedTuple, Optional

from testing.golden.golden import BACKEND_DIR, RESULTS_DIR, golden_path, load, packages, run

CATEGORIES = ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')
SEVERITIES = {'errors': 'error', 'warnings': 'warning', 'infos': 'info'}

# v1 keys whose subject (v2) is the item they point at: a text frame or an image frame. v1 grouped them by story
# (by the default style for unstyled text, by nothing for object styles), v2 by the frame.
FRAME_SUBJECTS = {'PARAGRAPH_STYLE', 'PARAGRAPH_STYLE_TEXT_BOX', 'TABLE', 'AUTO_SIZE_TEXT_BOX', 'TEXT_COLUMNS',
                  'LINKED_TEXT_FRAME', 'OBJECT_STYLE_TEXT', 'TEXT_WRAP', 'OVERRIDE', 'EMPTY_TEXT_FRAME',
                  'IMAGE_TRANSFORMATION_CONTAINER'}
# v1 keys about a page item, which v1 identified as 'Kind:Self'.
PAGE_ITEM_SUBJECTS = {'TEXT_WRAP_ITEM', 'PAGE_ITEM_TRANSFORMATION'}
STYLE_PREFIXES = ('ParagraphStyle/$ID/', 'ParagraphStyle/', 'CharacterStyle/$ID/', 'CharacterStyle/')

# v1 keys that become one check in v2 (plan §3.1): same fix, only the kind of item differs.
CHECK_FAMILY = {
    'TEXT_WRAP_ITEM': 'TEXT_WRAP',
    'OBJECT_STYLE_TEXT': 'OBJECT_STYLE',
    'OBJECT_STYLE_IMAGE': 'OBJECT_STYLE',
    'IMAGE_TRANSFORMATION_IMAGE': 'TRANSFORMATION',
    'IMAGE_TRANSFORMATION_CONTAINER': 'TRANSFORMATION',
    'PAGE_ITEM_TRANSFORMATION': 'TRANSFORMATION',
    'PARAGRAPH_STYLE_TEXT_BOX': 'PARAGRAPH_STYLE',
}


class ProjectedIssue(NamedTuple):
    severity: str          # error | warning | info
    check: str             # v2 check key (CHECK_FAMILY applied)
    subject_id: str        # style (short id: '[No paragraph style]', 'Bold'), frame or item Self, font or file name
    item_id: str           # '' when the issue has none
    page_id: str
    facts: str             # context_details as sorted JSON, '' when there are none
    detail: str            # the display text (v1 context)

    def __str__(self):
        where = ', '.join(f'{k}={v}' for k, v in (('item', self.item_id), ('page', self.page_id)) if v)
        extra = ' | '.join(x for x in (self.detail, self.facts) if x)
        return f'{self.severity:7} {self.check} {self.subject_id!r} ({where}){" | " + extra if extra else ""}'


def _facts(details) -> str:
    if not details:
        return ''
    # v1 spelled inherited_from as inheritedFrom.
    details = {('inherited_from' if key == 'inheritedFrom' else key): value for key, value in details.items()}
    return json.dumps(details, sort_keys=True, ensure_ascii=False)


def _no_id(value) -> str:
    return '' if value in (None, '', 'null') else value


def _short_style(style_id: str) -> str:
    prefix = next((p for p in STYLE_PREFIXES if style_id.startswith(p)), '')
    return style_id[len(prefix):]


def _v1_subject(classifier: str, identifier: str, item_id: str) -> str:
    if classifier in FRAME_SUBJECTS and item_id:
        return item_id
    if classifier in PAGE_ITEM_SUBJECTS:
        return identifier.partition(':')[2]
    return _no_id(identifier)


def project(results: dict) -> Counter:
    """The issues in a results dict (v1 or v2), as a multiset (the same issue can be reported twice)."""
    if results.get('schema_version') == 2:
        return _project_v2(results)
    issues = Counter()
    for category in CATEGORIES:
        for identifier, by_severity in results.get(category, {}).get('details', {}).items():
            for severity, items in by_severity.items():
                for item in items:
                    classifier = item['validationClassifier']
                    item_id = _no_id(item.get('data_id'))
                    issues[ProjectedIssue(
                        SEVERITIES[severity], CHECK_FAMILY.get(classifier, classifier),
                        _v1_subject(classifier, identifier, item_id), item_id, item.get('page_id') or '',
                        _facts(item.get('context_details')), item.get('context') or '')] += 1
    return issues


def _project_v2(results: dict) -> Counter:
    issues = Counter()
    for issue in results['issues']:
        subject, location = issue['subject'], issue['location']
        subject_id = _no_id(subject['id'])
        if subject['kind'] in ('paragraph_style', 'character_style'):
            subject_id = _short_style(subject_id)
        issues[ProjectedIssue(issue['severity'], issue['check'], subject_id, _no_id(location['item_id']),
                              location['page_id'] or '', _facts(issue['facts']), issue['detail'] or '')] += 1
    return issues


def diff(before: Counter, after: Counter):
    """(removed, added): issues only in before, issues only in after (with multiplicity)."""
    return sorted((before - after).elements()), sorted((after - before).elements())


def _golden_at(ref: str, package: str) -> Optional[dict]:
    path = './' + golden_path(package)[len(BACKEND_DIR) + 1:]
    shown = subprocess.run(['git', 'show', f'{ref}:{path}'], cwd=BACKEND_DIR, capture_output=True, text=True)
    return json.loads(shown.stdout) if shown.returncode == 0 else None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Issues added and removed per package, golden results -> current code.')
    parser.add_argument('packages', nargs='*', help='package names in testing/packages/ (default: all)')
    parser.add_argument('--base', help='read the golden results at this git ref instead of the working tree')
    args = parser.parse_args(argv)

    changed = added_total = removed_total = 0
    for package in args.packages or packages():
        old = _golden_at(args.base, package) if args.base else load(package)
        new = run(package)
        if old is None:
            print(f'\n{package}: no golden results{" at " + args.base if args.base else ""}')
            changed += 1
            continue
        removed, added = diff(project(old['results']), project(new['results']))
        stage_changed = old['stopped_at'] != new['stopped_at']
        if not (removed or added or stage_changed):
            continue
        changed += 1
        added_total, removed_total = added_total + len(added), removed_total + len(removed)
        print(f'\n{package}')
        if stage_changed:
            print(f'  stopped at: {old["stopped_at"]} -> {new["stopped_at"]}')
        for issue in removed:
            print(f'  - {issue}')
        for issue in added:
            print(f'  + {issue}')
    print(f'\n{changed} package(s) with changed issues: +{added_total} -{removed_total}'
          f' (base: {args.base or "stored goldens in " + RESULTS_DIR})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
