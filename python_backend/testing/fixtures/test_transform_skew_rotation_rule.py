"""Transforms are judged by their end state. A skew is reported whether or not the item is also rotated:
Frontify mispositions rotated items that are skewed (PageItem.php getTransformationData skips the
y-correction), so rotation + skew is an error. A rotation on its own is fine: Frontify carries it over
(docs/checker-rules.md, decision 8)."""
import math

import pytest

from src.helpers.page_item_transform import TransformKind, classify_page_item_transform
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def rotation(degrees, sx=1.0, sy=1.0):
    """ItemTransform a b c d for a scale followed by a rotation (axes stay at right angles)."""
    t = math.radians(degrees)
    return sx * math.cos(t), sx * math.sin(t), -sy * math.sin(t), sy * math.cos(t)


def skew_then_rotate(skew_degrees, rotate_degrees):
    t, k = math.radians(rotate_degrees), math.tan(math.radians(skew_degrees))
    rot = lambda x, y: (x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t))
    return (*rot(1, 0), *rot(k, 1))


@pytest.mark.parametrize('matrix', [skew_then_rotate(20, 30), skew_then_rotate(10, -45), skew_then_rotate(-15, 90),
                                    (0.866, 0.5, -0.185, 1.048)])
def test_rotated_and_skewed_is_a_skew(matrix):
    result = classify_page_item_transform(*matrix)
    assert result.kind == TransformKind.SKEW
    assert result.is_error
    assert 'rotation' in result.message


def test_skew_without_rotation():
    result = classify_page_item_transform(1, 0, 0.364, 1)
    assert result.kind == TransformKind.SKEW
    assert 'rotation' not in result.message


@pytest.mark.parametrize('matrix', [rotation(30), rotation(-90), rotation(45, sx=2, sy=0.5), (-1, 0, 0, -1)])
def test_rotation_only_is_not_an_issue(matrix):
    result = classify_page_item_transform(*matrix)
    assert result.kind == TransformKind.ROTATION
    assert not result.is_error


@pytest.mark.parametrize('matrix,kind', [((-1, 0, 0, 1), TransformKind.FLIP_HORIZONTAL),
                                         ((1, 0, 0, -1), TransformKind.FLIP_VERTICAL),
                                         ((0, -1, -1, 0), TransformKind.FLIP),
                                         ((1, 0, 0, 1), TransformKind.NONE),
                                         ((2, 0, 0, 3), TransformKind.NONE)])
def test_other_cases_unchanged(matrix, kind):
    assert classify_page_item_transform(*matrix).kind == kind


def test_rotated_and_skewed_text_frame_is_an_error(tmp_path):
    a, b, c, d = skew_then_rotate(20, 30)
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Skewed')]), transform=f'{a} {b} {c} {d} 0 -396')
    run = run_checker(pkg.write(tmp_path))
    assert [i.severity for i in run.of('TRANSFORMATION', 'page_item')] == ['error']


def test_rotated_and_skewed_image_frame_is_an_error(tmp_path):
    a, b, c, d = skew_then_rotate(20, 30)
    pkg = PackageBuilder()
    pkg.image('photo.jpg', frame_transform=f'{a} {b} {c} {d} 0 -396')
    run = run_checker(pkg.write(tmp_path))
    assert [i.severity for i in run.of('TRANSFORMATION', 'image_frame')] == ['error']


def test_rotated_items_raise_nothing(tmp_path):
    a, b, c, d = rotation(30)
    pkg = PackageBuilder()
    pkg.text_frame(pkg.story([('Body', 'Rotated')]), transform=f'{a} {b} {c} {d} 0 -396')
    pkg.image('photo.jpg', frame_transform=f'{a} {b} {c} {d} 0 -396', image_transform=f'{a} {b} {c} {d} 0 0')
    run = run_checker(pkg.write(tmp_path))
    assert run.of('TRANSFORMATION') == []
