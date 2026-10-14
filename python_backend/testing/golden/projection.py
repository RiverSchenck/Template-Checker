"""Issue projection: a checker result reduced to the issues it reports, comparable across code versions.

Every behaviour PR proves its effect with this: the issues added and removed per package must be exactly the
ones it set out to change.

    python -m testing.golden.projection                      # stored goldens -> current code
    python -m testing.golden.projection --base origin/main   # goldens at a git ref -> current code
    python -m testing.golden.projection "1 large image.zip"     # only these packages (names in testing/packages/)
"""
import argparse
import json
import subprocess
import sys
from collections import Counter
from typing import NamedTuple, Optional

from testing.golden.golden import BACKEND_DIR, RESULTS_DIR, golden_path, load, packages, run

STYLE_PREFIXES = ('ParagraphStyle/$ID/', 'ParagraphStyle/', 'CharacterStyle/$ID/', 'CharacterStyle/')


class ProjectedIssue(NamedTuple):
    severity: str          # error | warning | info
    check: str
    subject_id: str        # style (short id: '[No paragraph style]', 'Bold'), frame or item Self, font or file name
    item_id: str           # '' when the issue has none
    page_id: str
    facts: str             # the facts as sorted JSON, '' when there are none
    note: str

    def __str__(self):
        where = ', '.join(f'{k}={v}' for k, v in (('item', self.item_id), ('page', self.page_id)) if v)
        extra = ' | '.join(x for x in (self.note, self.facts) if x)
        return f'{self.severity:7} {self.check} {self.subject_id!r} ({where}){" | " + extra if extra else ""}'


def _facts(details) -> str:
    return json.dumps(details, sort_keys=True, ensure_ascii=False) if details else ''


def _no_id(value) -> str:
    return '' if value in (None, '', 'null') else value


def _short_style(style_id: str) -> str:
    prefix = next((p for p in STYLE_PREFIXES if style_id.startswith(p)), '')
    return style_id[len(prefix):]


def project(results: dict) -> Counter:
    """The issues in results v2, as a multiset (the same issue can be reported twice)."""
    issues = Counter()
    for issue in results['issues']:
        subject, location = issue['subject'], issue['location']
        subject_id = _no_id(subject['id'])
        if subject['kind'] in ('paragraph_style', 'character_style'):
            subject_id = _short_style(subject_id)
        issues[ProjectedIssue(issue['severity'], issue['check'], subject_id, _no_id(location['item_id']),
                              location['page_id'] or '', _facts(issue['facts']), issue.get('note') or '')] += 1
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
