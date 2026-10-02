import math
from dataclasses import dataclass
from enum import Enum, auto
from typing import Optional, Tuple


class TransformKind(Enum):
    NONE = auto()
    FLIP_HORIZONTAL = auto()
    FLIP_VERTICAL = auto()
    SKEW = auto()
    ROTATION = auto()


@dataclass(frozen=True)
class TransformClassification:
    kind: TransformKind
    message: str


def parse_item_transform(s: str) -> Optional[Tuple[float, float, float, float, float, float]]:
    if not s or not str(s).strip():
        return None
    parts = str(s).split()
    if len(parts) != 6:
        return None
    try:
        vals = tuple(map(float, parts))
        return (vals[0], vals[1], vals[2], vals[3], vals[4], vals[5])
    except ValueError:
        return None


def classify_page_item_transform(a: float, b: float, c: float, d: float) -> TransformClassification:
    """
    Classify the 2x2 linear part of an InDesign ItemTransform matrix.
    Mirrors image_transformation_check priority for flips and rotation; skew is reported only
    when rotation angle is near zero (image check leaves skew unreachable when rotation is nonzero).
    """
    rotation_angle = math.atan2(b, a)
    rotation_angle_degrees = math.degrees(rotation_angle)

    if a < 0 and d > 0 and abs(rotation_angle_degrees) != 180:
        return TransformClassification(
            TransformKind.FLIP_HORIZONTAL,
            "has a horizontal flip transformation.",
        )
    if a > 0 and d < 0 and abs(rotation_angle_degrees) != 180:
        return TransformClassification(
            TransformKind.FLIP_VERTICAL,
            "has a vertical flip transformation.",
        )
    if abs(rotation_angle_degrees) > 0.01:
        return TransformClassification(
            TransformKind.ROTATION,
            f"has been rotated by {rotation_angle_degrees:.2f} degrees.",
        )
    if abs(b) > 0.01 or abs(c) > 0.01:
        return TransformClassification(
            TransformKind.SKEW,
            f"has skew transformations. Skew factors: b={b}, c={c}",
        )
    return TransformClassification(TransformKind.NONE, "")
