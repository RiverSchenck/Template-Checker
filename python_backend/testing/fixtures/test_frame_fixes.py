"""Frame bugs fixed when checks moved to the Document (plan PR 2.4): B5 (an image frame flipped or skewed was
reported twice), B8 (a text frame without thread attributes counted as linked) and where B3's items placed in
text are located (tests/fixtures/test_story_coverage.py checks that they're seen)."""
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


def linked_frames(tmp_path, **thread):
    pkg = PackageBuilder()
    frame = pkg.text_frame(pkg.story([('Body', 'Hello')]), **thread)
    return frame, [i.data_id for i in run_checker(pkg.write(tmp_path)).of('LINKED_TEXT_FRAME')]


@pytest.mark.parametrize('thread', [dict(previous='n', next='n'), dict(previous=None, next=None)], ids=['n', 'missing'])
def test_unthreaded_frame_is_not_linked(tmp_path, thread):
    assert linked_frames(tmp_path, **thread)[1] == []


@pytest.mark.parametrize('thread', [dict(previous='u5', next='n'), dict(previous=None, next='u6')], ids=['previous', 'next'])
def test_threaded_frame_is_linked(tmp_path, thread):
    frame, linked = linked_frames(tmp_path, **thread)
    assert linked == [frame]


def test_image_placed_in_text_is_located_on_its_story_frame_page(tmp_path):
    pkg = PackageBuilder(pages=2)
    image = pkg.inline_image('photo.jpg', image_transform=FLIPPED)
    story = pkg.raw_story('<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Body"><CharacterStyleRange '
                          f'AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">{image}</CharacterStyleRange>'
                          '</ParagraphStyleRange>')
    pkg.text_frame(story, page=1)
    [issue] = [i for i in run_checker(pkg.write(tmp_path)).issues if i.classifier == 'IMAGE_TRANSFORMATION_IMAGE']
    frame_id = image.split('Self="', 1)[1].split('"', 1)[0]
    assert (issue.identifier, issue.data_id, issue.page_id) == ('photo.jpg', frame_id, 'page1')
