import pytest
from lxml import etree as ET

from src.checks.layout import page_item_transformation_check
from src.model.document import Document
from src.model.layout import load_layout, read_spread
from src.results.results import Results
from src.results.classifiers import Severity, ValidationError
from src.helpers.page_item_transform import (
    parse_item_transform,
    classify_page_item_transform,
    TransformKind,
)


def test_parse_item_transform_valid():
    t = parse_item_transform("1 0 0 1 10 20")
    assert t == (1.0, 0.0, 0.0, 1.0, 10.0, 20.0)


def test_parse_item_transform_invalid():
    assert parse_item_transform("") is None
    assert parse_item_transform("1 2 3") is None
    assert parse_item_transform(None) is None  # type: ignore[arg-type]


def test_classify_skew_when_rotation_near_zero():
    c = classify_page_item_transform(1.0, 0.0, 0.2, 1.0)
    assert c.kind == TransformKind.SKEW


def test_classify_rotation():
    import math
    rad = math.radians(15)
    cos_r, sin_r = math.cos(rad), math.sin(rad)
    c = classify_page_item_transform(cos_r, sin_r, -sin_r, cos_r)
    assert c.kind == TransformKind.ROTATION
    assert "degrees" in c.message


def test_classify_none_identity():
    c = classify_page_item_transform(1.0, 0.0, 0.0, 1.0)
    assert c.kind == TransformKind.NONE


def test_page_items_are_checked_but_a_linked_rectangle_is_left_to_the_image_check():
    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<Root>
  <Spread Self="spread1">
    <Page Self="page1" Name="1"/>
    <TextFrame Self="tf1" ItemTransform="1 0 0.15 1 0 0"/>
    <Rectangle Self="linkedRect" ItemTransform="1 0 0.15 1 0 0">
      <Link Self="l1" LinkResourceURI="file:///dummy.png" StoredState="Normal"/>
    </Rectangle>
    <Rectangle Self="plainRect" ItemTransform="1 0 0.15 1 0 0"/>
    <Group Self="g1" ItemTransform="1 0 0.15 1 0 0"/>
  </Spread>
</Root>"""
    spread = read_spread(ET.fromstring(xml).find('Spread'))
    results = Results()
    page_item_transformation_check(Document(spreads=(spread,)), results)
    reported = {issue.identifier for issue in results}
    assert reported == {"TextFrame:tf1", "Rectangle:plainRect", "Group:g1"}


def test_page_item_transformation_check_skew_textframe(tmp_path):
    spreads_dir = tmp_path / "Spreads"
    spreads_dir.mkdir()
    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<Root>
  <Spread Self="spread1">
    <Page Self="page1" Name="1"/>
    <TextFrame Self="tf_skew" ItemTransform="1 0 0.15 1 0 0"/>
  </Spread>
</Root>"""
    (spreads_dir / "Spread_uc0.xml").write_bytes(xml)

    # A check runs on a parsed document directly: no package to unzip.
    results = Results()
    page_item_transformation_check(Document(spreads=load_layout(str(tmp_path)).spreads), results)

    errors = results.names(Severity.ERROR)
    assert errors.count(ValidationError.PAGE_ITEM_TRANSFORMATION.value) == 1
    assert results.names(Severity.WARNING) == []
