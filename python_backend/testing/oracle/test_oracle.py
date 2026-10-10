"""The checker's results must match an independent reading of the IDML, for every test package.

Known disagreements are listed in KNOWN_GAPS with the plan item that fixes them. Markers are strict:
once a fix lands the test starts passing, which fails the run until the entry is removed.
"""
import pytest

from testing.golden.golden import packages
from testing.oracle.compare import CHECKS, compare

KNOWN_GAPS = {
    'image_transformations': 'B7: a flip whose matrix also reads as a 180 or 90 degree turn (e.g. "-1 0 0 1") is reported as a rotation',
    'composer': 'B2: composer warnings show grid alignment\'s "Inherited from" (StoryParagraphData.get_composer_obj)',
}


def _params():
    for check in CHECKS:
        marks = [pytest.mark.xfail(reason=KNOWN_GAPS[check], strict=True)] if check in KNOWN_GAPS else []
        yield pytest.param(check, marks=marks, id=check)


@pytest.mark.parametrize('check', _params())
def test_checker_matches_oracle(check):
    mismatches = []
    for package in packages():
        pair = compare(package, check)
        if pair is None:
            continue
        expected, actual = pair
        if expected != actual:
            if isinstance(expected, set):
                mismatches.append(f'{package}: oracle only {sorted(expected - actual)}, checker only {sorted(actual - expected)}')
            else:
                mismatches.append(f'{package}: oracle {expected}, checker {actual}')
    assert not mismatches, f'{len(mismatches)} packages disagree:\n' + '\n'.join(mismatches[:10])
