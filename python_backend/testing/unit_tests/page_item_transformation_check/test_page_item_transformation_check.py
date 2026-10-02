import pytest
from lxml import etree as ET

from src.classes.SpreadData import SpreadData
from src.classes.FrontifyChecker import FrontifyChecker
from src.classes.States import States
from src.parsers.SpreadsParser import SpreadsParser
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning
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


def test_spread_data_collects_candidates_and_skips_linked_rectangle():
    xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<Root>
  <Spread Self="spread1">
    <Page Self="page1" Name="1"/>
    <TextFrame Self="tf1" ItemTransform="1 0 0 1 0 0"/>
    <Rectangle Self="linkedRect" ItemTransform="1 0 0 1 0 0">
      <Link Self="l1" LinkResourceURI="file:///dummy.png" StoredState="Normal"/>
    </Rectangle>
    <Rectangle Self="plainRect" ItemTransform="1 0 0 1 0 0"/>
    <Group Self="g1" ItemTransform="1 0 0 1 0 0"/>
  </Spread>
</Root>"""
    root = ET.fromstring(xml)
    sd = SpreadData(root)
    cands = sd.get_page_item_transform_candidates()
    tags_self = {(c["tag"], c["self_id"]) for c in cands}
    assert ("TextFrame", "tf1") in tags_self
    assert ("Rectangle", "plainRect") in tags_self
    assert ("Group", "g1") in tags_self
    assert ("Rectangle", "linkedRect") not in tags_self


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

    checker = FrontifyChecker()
    checker.spreads_parser = SpreadsParser(str(spreads_dir))
    checker._build_data_id_to_page_id_mapping()
    next_state = checker.page_item_transformation_check()

    assert next_state == States.TABLE_CHECK
    errors = checker.get_error_types()
    assert errors.count(ValidationError.PAGE_ITEM_TRANSFORMATION.value) == 1
    assert ValidationWarning.PAGE_ITEM_TRANSFORMATION.value not in checker.get_warning_types()
