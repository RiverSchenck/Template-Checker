"""Frame bugs fixed when checks moved to the Document (plan PR 2.4): B5 (an image frame flipped or skewed was
reported twice) and B8 (a text frame without thread attributes counted as linked)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

FLIPPED = '-1 0 0 1 300 0'


def transform_issues(tmp_path, build):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Hello')]))
    build(pkg)
    run = run_checker(pkg.write(tmp_path))
    return sorted((i.classifier, i.data_id) for i in run.issues if 'TRANSFORMATION' in i.classifier)


@pytest.mark.parametrize('frame', ['Rectangle', 'Oval', 'Polygon'])
def test_flipped_image_frame_is_reported_once(tmp_path, frame):
    ids = {}
    issues = transform_issues(tmp_path, lambda pkg: ids.setdefault('frame', pkg.image('a.jpg', frame=frame, frame_transform=FLIPPED)))
    assert issues == [('IMAGE_TRANSFORMATION_CONTAINER', ids['frame'])]


def test_flipped_empty_frame_is_still_a_page_item(tmp_path):
    ids = {}
    issues = transform_issues(tmp_path, lambda pkg: ids.setdefault('frame', pkg.shape('Oval', transform=FLIPPED)))
    assert issues == [('PAGE_ITEM_TRANSFORMATION', ids['frame'])]
