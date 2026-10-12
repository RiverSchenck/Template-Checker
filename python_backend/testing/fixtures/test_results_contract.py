"""The results JSON must contain every issue the checks recorded (docs/PLAN-backend-refactor.md, B8)."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def test_b8_issues_without_an_identifier_all_reach_the_json(tmp_path):
    # Master-page items and bleed have no identifier; a zero-byte image is a general error too. Before the fix,
    # "no identifier" was stored as both None and 'null', and one group overwrote the other in the JSON.
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'x')]))
    pkg.image('on-master.png', master=0)
    pkg.image('empty.png', size_bytes=0)
    pkg.bleed = '9'
    general = run_checker(pkg.write(tmp_path)).results['general']['details']
    assert list(general) == ['null']
    assert sorted(i['validationClassifier'] for items in general['null'].values() for i in items) == [
        'DOCUMENT_BLEED', 'ERROR', 'MASTERPAGE']
