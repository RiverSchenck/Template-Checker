"""Phase 1 crash and latent-bug fixes (docs/PLAN-backend-refactor.md, B1 and L1-L7).

Each builds the smallest package that triggers the bug. None of these change results for real test packages
(the golden results stay identical); they cover inputs the 187 test packages don't contain.
"""
from lxml import etree as ET

from src.classes.Link import Link
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def text_package(**kwargs) -> PackageBuilder:
    pkg = PackageBuilder(**kwargs)
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    return pkg


def test_b1_package_without_master_spreads_is_checked(tmp_path):
    run = run_checker(text_package(master_spreads=False).write(tmp_path))
    assert run.stopped_at == 'RESULTS'
    assert 'MASTERPAGE' not in run.classifiers()


def test_l1_images_on_every_master_count_as_used(tmp_path):
    pkg = text_package(masters=2)
    pkg.image('logo-a.png', master=0)
    pkg.image('logo-b.png', master=1)
    run = run_checker(pkg.write(tmp_path))
    assert run.of('UNUSED_IMAGE') == []
    assert run.of('IMAGE_INCLUDED') == []


def test_l1_missing_image_on_an_earlier_master_is_reported(tmp_path):
    pkg = text_package(masters=2)
    pkg.image('only-on-master-1.png', master=0, include_in_links=False)
    pkg.image('logo-b.png', master=1)
    run = run_checker(pkg.write(tmp_path))
    assert [i.identifier for i in run.of('IMAGE_INCLUDED')] == ['only-on-master-1.png']


def test_l2_a_malformed_link_is_skipped_not_crashed_on(tmp_path):
    pkg = text_package()
    pkg.image('broken.png', broken_link=True, include_in_links=False)
    pkg.image('fine.png', embedded=True, include_in_links=False)
    run = run_checker(pkg.write(tmp_path))
    assert run.stopped_at == 'RESULTS'
    assert [i.identifier for i in run.of('EMBEDDED_IMAGE')] == ['fine.png']


def test_l3_link_without_a_grandparent_element():
    image = ET.fromstring('<Image Self="i1" ItemTransform="1 0 0 1 0 0">'
                          '<Link Self="l1" LinkResourceURI="file:/x/Links/a.png" StoredState="Normal"/></Image>')
    link = Link(image.find('Link'))
    assert link.get_image_name() == 'a.png'
    assert link.get_rectangle_link_id() is None
    assert link.get_container_item_transform() is None


def test_l4_text_frame_whose_story_is_missing(tmp_path):
    pkg = text_package()
    frame = pkg.text_frame('u999', columns=2, object_style='ObjectStyle/Custom')  # no story u999 in the package
    run = run_checker(pkg.write(tmp_path))
    assert run.stopped_at == 'RESULTS'
    [columns] = run.of('TEXT_COLUMNS')
    assert (columns.identifier, columns.data_id) == ('u999', frame)
    assert [i.data_id for i in run.of('OBJECT_STYLE_TEXT')] == [frame]


def test_l5_cyclic_based_on_does_not_crash(tmp_path):
    pkg = PackageBuilder()
    pkg.paragraph_style('A', based_on='B')
    pkg.paragraph_style('B', based_on='A')
    pkg.text_frame(pkg.story([('A', 'Loop')]))
    run = run_checker(pkg.write(tmp_path))
    assert run.stopped_at == 'RESULTS'


def test_l6_frame_without_wrap_settings_has_no_wrap(tmp_path):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'No wrap element')]), wrap=None)
    assert run_checker(pkg.write(tmp_path)).of('TEXT_WRAP') == []


def test_l6_unresolvable_grid_alignment_is_not_an_issue(tmp_path):
    pkg = PackageBuilder()
    pkg.paragraph_style('A', based_on='B')   # cycle: GridAlignment can't be resolved
    pkg.paragraph_style('B', based_on='A')
    pkg.text_frame(pkg.story([('A', 'Loop')]))
    assert run_checker(pkg.write(tmp_path)).of('GRID_ALIGNMENT') == []


def test_l7_text_wrap_still_checked_when_document_has_no_stories(tmp_path):
    pkg = PackageBuilder()
    frame = pkg.text_frame('u999', wrap='BoundingBoxTextWrap')  # a frame, but no Stories/ at all
    run = run_checker(pkg.write(tmp_path))
    assert run.stopped_at == 'RESULTS'
    assert [i.data_id for i in run.of('TEXT_WRAP')] == [frame]
