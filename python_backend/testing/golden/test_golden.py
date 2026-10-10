import pytest

from testing.golden.golden import first_differences, load, packages, run


@pytest.mark.parametrize('package', packages())
def test_results_match_golden(package):
    expected = load(package)
    assert expected is not None, f'No golden results for {package}. Run: python -m testing.golden --update'
    actual = run(package)
    if actual != expected:
        diffs = '\n  '.join(first_differences(expected, actual))
        pytest.fail(f'{package} differs from its golden results:\n  {diffs}\n'
                    'If this change is intended, run: python -m testing.golden --update', pytrace=False)
