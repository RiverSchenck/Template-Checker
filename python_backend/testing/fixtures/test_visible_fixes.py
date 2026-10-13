"""Phase 1 fixes that change what users see (docs/PLAN-backend-refactor.md, B2 B4 B5 B7).

Rules confirmed with the product owner are in docs/checker-rules.md.
"""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


# --- B2: composer context names the style the composer was inherited from -----------------------------------

def test_b2_composer_says_where_it_is_inherited_from(tmp_path):
    pkg = PackageBuilder()
    # Composer comes from Base; grid alignment from the root style, so the two "Inherited from"s differ.
    pkg.paragraph_style('Base', Composer='HL Composer')
    pkg.paragraph_style('Heading', based_on='Base')
    pkg.text_frame(pkg.story([('Heading', 'Title')]))
    [issue] = run_checker(pkg.write(tmp_path)).of('COMPOSER')
    assert issue.detail == 'Inherited from: ParagraphStyle/Base'


def test_b2_composer_set_on_the_style_itself_has_no_inherited_from(tmp_path):
    pkg = PackageBuilder()
    pkg.paragraph_style('Heading', Composer='HL Composer')  # grid alignment still inherited from the root
    pkg.text_frame(pkg.story([('Heading', 'Title')]))
    [composer] = run_checker(pkg.write(tmp_path)).of('COMPOSER')
    assert composer.detail == ''


# --- B4 + B5: pages ------------------------------------------------------------------------------------------

def text_box_page(run, frame):
    """(page id, page name) of a text frame's text in the results."""
    page_id = run.results['text_boxes'][frame]['page_id']
    return page_id, next(page['name'] for page in run.results['pages'] if page['id'] == page_id)


def test_b4_text_box_data_carries_the_page_id_and_name(tmp_path):
    pkg = PackageBuilder()
    story = pkg.story([('Body', 'Two columns')])
    frame = pkg.text_frame(story, columns=2)
    assert text_box_page(run_checker(pkg.write(tmp_path)), frame) == ('page0', '1')


@pytest.mark.parametrize('page', [0, 1])
def test_b5_issue_names_the_page_the_item_is_on(tmp_path, page):
    pkg = PackageBuilder(pages=2)
    story = pkg.story([('Body', 'Linked')])
    frame = pkg.text_frame(story, page=page, next='u999')
    run = run_checker(pkg.write(tmp_path))
    [issue] = run.of('LINKED_TEXT_FRAME')
    assert (issue.page_id, issue.page_name) == (f'page{page}', str(page + 1))
    assert text_box_page(run, frame) == (f'page{page}', str(page + 1))


def test_b5_image_on_right_hand_page(tmp_path):
    pkg = PackageBuilder(pages=2)
    pkg.image('photo.png', page=1, embedded=True, include_in_links=False)
    [issue] = run_checker(pkg.write(tmp_path)).of('EMBEDDED_IMAGE')
    assert (issue.page_id, issue.page_name) == ('page1', '2')


# --- B7: end state decides: only rotated -> warning, mirrored -> flip error ------------------------------------

def _transform_issues(tmp_path, *, frame=None, image='1 0 0 1 0 0'):
    pkg = PackageBuilder()
    pkg.image('photo.png', frame_transform=frame, image_transform=image)
    return [(i.severity, i.check, i.kind, i.detail) for i in run_checker(pkg.write(tmp_path)).issues]


def test_b7_horizontal_flip_of_the_frame_is_a_flip_error(tmp_path):
    assert _transform_issues(tmp_path, frame='-1 0 0 1 0 -396') == [
        ('error', 'TRANSFORMATION', 'image_frame', 'Image Container has a horizontal flip transformation.')]


def test_b7_mirrored_and_turned_90_degrees_is_a_flip_error(tmp_path):
    assert _transform_issues(tmp_path, image='0 -4 -4 0 0 0') == [
        ('error', 'TRANSFORMATION', 'image', 'Image inside Container has a flip transformation.')]


def test_b7_vertical_flip_unchanged(tmp_path):
    assert _transform_issues(tmp_path, image='1 0 0 -1 0 0') == [
        ('error', 'TRANSFORMATION', 'image', 'Image inside Container has a vertical flip transformation.')]


def test_b7_a_real_180_degree_turn_is_not_an_issue(tmp_path):
    """'-1 0 0 -1' is a 180 degree turn, not a flip, and rotation is fine (Frontify carries it over)."""
    assert _transform_issues(tmp_path, image='-1 0 0 -1 0 0') == []


def test_b7_page_items_use_the_same_rule(tmp_path):
    pkg = PackageBuilder()
    frame = pkg.text_frame(pkg.story([('Body', 'Mirrored')]), transform='-1 0 0 1 0 -396')
    issues = run_checker(pkg.write(tmp_path)).of('TRANSFORMATION', 'page_item')
    assert [(i.severity, i.item_id, i.detail) for i in issues] == [
        ('error', frame, 'TextFrame has a horizontal flip transformation.')]
