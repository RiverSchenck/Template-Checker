import os

import pytest
from src.helpers.page_geometry import PageGeometryIndex


def rect(self_id, left, top, right, bottom, transform='1 0 0 1 0 0', inner='', tag='Rectangle'):
    anchors = [(left, top), (left, bottom), (right, bottom), (right, top)]
    points = ''.join(f'<PathPointType Anchor="{x} {y}" LeftDirection="{x} {y}" RightDirection="{x} {y}"/>'
                     for x, y in anchors)
    return (f'<{tag} Self="{self_id}" ItemTransform="{transform}"><Properties><PathGeometry><GeometryPathType>'
            f'<PathPointArray>{points}</PathPointArray></GeometryPathType></PathGeometry></Properties>'
            f'{inner}</{tag}>')


@pytest.fixture
def idml_folder(tmp_path):
    """Two-page spread (pages of 600x800 side by side, spread origin at the page join)."""
    items = ''.join([
        # Text frame on the left page.
        rect('text1', -500, -300, -300, -200, tag='TextFrame'),
        # Image frame on the right page; the Link has no geometry of its own.
        rect('rect1', 100, -400, 300, -200,
             inner='<Image Self="img1" ItemTransform="2 0 0 2 0 0"><Link Self="link1"/></Image>'),
        # Group moved 50pt right and 100pt down; child coordinates are relative to it.
        '<Group Self="group1" ItemTransform="1 0 0 1 50 100">'
        + rect('child1', 0, 0, 100, 50) + '</Group>',
        # Rotated 90 degrees around the spread origin.
        rect('rotated1', 0, 0, 100, 20, transform='0 1 -1 0 300 0'),
    ])
    spread = (
        '<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">'
        '<Spread Self="sp1">'
        '<Page Self="p1" Name="1" GeometricBounds="0 0 800 600" ItemTransform="1 0 0 1 -600 -400"/>'
        '<Page Self="p2" Name="2" GeometricBounds="0 0 800 600" ItemTransform="1 0 0 1 0 -400"/>'
        f'{items}</Spread></idPkg:Spread>'
    )
    os.makedirs(tmp_path / 'Spreads')
    (tmp_path / 'Spreads' / 'Spread_sp1.xml').write_text(spread)
    (tmp_path / 'designmap.xml').write_text(
        '<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">'
        '<idPkg:Spread src="Spreads/Spread_sp1.xml"/></Document>')
    return str(tmp_path)


def test_pages_in_document_order(idml_folder):
    pages = PageGeometryIndex(idml_folder).get_pages()
    assert [(p['page_id'], p['index'], p['width'], p['height']) for p in pages] == [
        ('p1', 1, 600, 800), ('p2', 2, 600, 800)]


def test_frame_bounds_are_page_relative(idml_folder):
    index = PageGeometryIndex(idml_folder)
    assert index.get_bounds('text1') == {'page_id': 'p1', 'kind': 'TextFrame', 'x': 100, 'y': 100, 'width': 200, 'height': 100}
    assert index.get_bounds('rect1') == {'page_id': 'p2', 'kind': 'Rectangle', 'x': 100, 'y': 0, 'width': 200, 'height': 200}


def test_link_resolves_to_its_frame_not_the_image(idml_folder):
    index = PageGeometryIndex(idml_folder)
    assert index.get_bounds('link1') == index.get_bounds('rect1')
    assert index.get_bounds('img1') == index.get_bounds('rect1')


def test_group_transforms_are_composed(idml_folder):
    index = PageGeometryIndex(idml_folder)
    assert index.get_bounds('child1') == {'page_id': 'p2', 'kind': 'Rectangle', 'x': 50, 'y': 500, 'width': 100, 'height': 50}
    assert index.get_bounds('group1') == {**index.get_bounds('child1'), 'kind': 'Group'}


def test_rotated_item_uses_axis_aligned_box(idml_folder):
    assert PageGeometryIndex(idml_folder).get_bounds('rotated1') == {
        'page_id': 'p2', 'kind': 'Rectangle', 'x': 280, 'y': 400, 'width': 20, 'height': 100}


def test_unknown_ids_have_no_bounds(idml_folder):
    index = PageGeometryIndex(idml_folder)
    assert index.get_bounds('missing') is None
    assert index.get_bounds('null') is None
    assert index.get_bounds('') is None


def test_page_frames_list_outlines_per_page(idml_folder):
    frames = PageGeometryIndex(idml_folder).get_page_frames()
    assert sorted(f['kind'] for f in frames['p1']) == ['TextFrame']
    assert len(frames['p2']) == 3
