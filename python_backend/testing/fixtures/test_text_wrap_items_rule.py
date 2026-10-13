"""Text wrap: InDesign sets wrap on the object text flows around (an image, shape or group), not only on text
frames. Frontify ignores wrap everywhere, so any item with wrap on is an error (docs/rules-review-2026-10-12.md)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def wrap_issues(tmp_path, build):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Body copy')]))
    build(pkg)
    run = run_checker(pkg.write(tmp_path))
    return run.of('TEXT_WRAP'), run.of('TEXT_WRAP_ITEM')


def test_image_with_wrap(tmp_path):
    ids = {}
    frames, items = wrap_issues(tmp_path, lambda pkg: ids.setdefault('image', pkg.image('photo.jpg', wrap='BoundingBoxTextWrap')))
    assert frames == []
    assert [(i.severity, i.data_id, i.context) for i in items] == [
        ('errors', ids['image'], "Rectangle wrap is 'BoundingBoxTextWrap' not None.")]
    assert items[0].page_id == 'page0'


@pytest.mark.parametrize('tag', ['Rectangle', 'Oval', 'Polygon', 'GraphicLine'])
def test_shape_with_wrap(tmp_path, tag):
    _, items = wrap_issues(tmp_path, lambda pkg: pkg.shape(tag, wrap='Contour'))
    assert [i.context for i in items] == [f"{tag} wrap is 'Contour' not None."]


def test_group_with_wrap(tmp_path):
    _, items = wrap_issues(tmp_path, lambda pkg: pkg.group(wrap='JumpObjectTextWrap'))
    assert [i.identifier.split(':')[0] for i in items] == ['Group']


def test_text_frame_wrap_still_reported_on_the_frame(tmp_path):
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Body copy')]), wrap='BoundingBoxTextWrap')
    run = run_checker(pkg.write(tmp_path))
    assert len(run.of('TEXT_WRAP')) == 1
    assert run.of('TEXT_WRAP_ITEM') == []


@pytest.mark.parametrize('wrap', [None, 'None'])
def test_no_wrap(tmp_path, wrap):
    def build(pkg):
        pkg.image('photo.jpg', wrap=wrap)
        pkg.shape('Oval', wrap=wrap)
        pkg.group(wrap=wrap)
    assert wrap_issues(tmp_path, build) == ([], [])
