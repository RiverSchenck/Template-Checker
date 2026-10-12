"""The builder must produce packages the checker reads the way it reads real InDesign exports."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def clean_package() -> PackageBuilder:
    pkg = PackageBuilder()
    story = pkg.story([('Body', 'Hello world')])
    pkg.text_frame(story)
    pkg.image('photo.jpg')
    return pkg


def test_clean_package_has_no_issues(tmp_path):
    run = run_checker(clean_package().write(tmp_path))
    assert run.stopped_at == 'RESULTS'
    assert run.issues == []


def test_each_knob_produces_exactly_its_issue(tmp_path):
    cases = {
        'TEXT_COLUMNS': lambda p: p.text_frame(p.story([('Body', 'Two columns')]), columns=2),
        'TEXT_WRAP': lambda p: p.text_frame(p.story([('Body', 'Wrapped')]), wrap='BoundingBoxTextWrap'),
        'EMBEDDED_IMAGE': lambda p: p.image('embedded.png', embedded=True, include_in_links=False),
        'IMAGE_INCLUDED': lambda p: p.image('missing.png', include_in_links=False),
        'DOCUMENT_BLEED': lambda p: setattr(p, 'bleed', '9'),
    }
    for expected, change in cases.items():
        pkg = clean_package()
        change(pkg)
        run = run_checker(pkg.write(tmp_path))
        assert set(run.classifiers()) == {expected}, (expected, run.classifiers())


def test_issues_point_at_the_built_items(tmp_path):
    pkg = clean_package()
    frame = pkg.text_frame(pkg.story([('Body', 'Linked')]), next='u999')
    run = run_checker(pkg.write(tmp_path))
    [issue] = run.of('LINKED_TEXT_FRAME')
    assert issue.data_id == frame
    assert issue.page_name == '1'


def test_style_inheritance(tmp_path):
    pkg = clean_package()
    pkg.paragraph_style('Base', Composer='HL Composer')
    pkg.paragraph_style('Heading', based_on='Base')
    pkg.text_frame(pkg.story([('Heading', 'Title')]))
    run = run_checker(pkg.write(tmp_path))
    [issue] = run.of('COMPOSER')
    assert issue.identifier == 'Heading'


def test_frame_positions_round_trip_through_page_geometry(tmp_path):
    pkg = PackageBuilder(pages=2)
    frame = pkg.text_frame(pkg.story([('Body', 'Right page')]), page=1, at=(50, 60, 200, 100), next='u999')
    run = run_checker(pkg.write(tmp_path))
    [issue] = run.of('LINKED_TEXT_FRAME')
    bounds = next(item for item in run.results['text_boxes']['details'][issue.identifier]['errors'])['bounds']
    assert (bounds['page_id'], bounds['x'], bounds['y'], bounds['width'], bounds['height']) == ('page1', 50, 60, 200, 100)
