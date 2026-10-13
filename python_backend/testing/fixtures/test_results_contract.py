"""The results JSON must contain every issue the checks recorded (docs/archive/PLAN-backend-refactor.md, B8)."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def test_b8_issues_without_an_identifier_all_reach_the_json(tmp_path):
    # Master-page items and bleed have no identifier; a zero-byte image is a general error too. Before the fix,
    # "no identifier" was stored as both None and 'null', and one group overwrote the other in the JSON. In
    # results v2 they're issues about the document.
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'x')]))
    pkg.image('on-master.png', master=0)
    pkg.image('empty.png', size_bytes=0)
    pkg.bleed = '9'
    issues = run_checker(pkg.write(tmp_path)).results['issues']
    assert sorted(i['check'] for i in issues if i['subject'] == {'kind': 'document', 'id': None, 'name': None}) == [
        'DOCUMENT_BLEED', 'ERROR', 'MASTERPAGE']
