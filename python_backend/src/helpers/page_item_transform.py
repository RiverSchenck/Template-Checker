import math
from dataclasses import dataclass
from enum import Enum, auto
from typing import Optional, Tuple


class TransformKind(Enum):
    NONE = auto()
    FLIP_HORIZONTAL = auto()
    FLIP_VERTICAL = auto()
    FLIP = auto()  # mirrored and turned, e.g. '0 -1 -1 0'
    SKEW = auto()
    ROTATION = auto()


@dataclass(frozen=True)
class TransformClassification:
    kind: TransformKind
    message: str

    @property
    def is_error(self) -> bool:
        """Flips and skews are errors. A rotation on its own is fine: Frontify carries it over."""
        return self.kind in (TransformKind.FLIP_HORIZONTAL, TransformKind.FLIP_VERTICAL, TransformKind.FLIP,
                             TransformKind.SKEW)


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
    Classify the 2x2 linear part of an InDesign ItemTransform matrix ('a b c d tx ty') by its end state
    (rule in docs/checker-rules.md):
    - mirrored (determinant a*d - b*c < 0) -> a flip, whatever rotation comes with it. '-1 0 0 1' is a
      horizontal flip; '-1 0 0 -1' is not mirrored, it's a 180 degree turn.
    - otherwise axes (a, b) and (c, d) not at right angles -> skew, rotated or not. Rotation and scaling keep
      them at right angles; only a skew doesn't. Frontify mispositions rotated items that are also skewed.
    - otherwise rotated (angle of the x axis) -> rotation.
    """
    if a * d - b * c < 0:
        if a < 0 < d:
            return TransformClassification(TransformKind.FLIP_HORIZONTAL, "has a horizontal flip transformation.")
        if d < 0 < a:
            return TransformClassification(TransformKind.FLIP_VERTICAL, "has a vertical flip transformation.")
        # Mirrored and turned (e.g. '0 -1 -1 0'): neither axis simply reversed.
        return TransformClassification(TransformKind.FLIP, "has a flip transformation.")
    rotation_angle_degrees = math.degrees(math.atan2(b, a))
    rotated = abs(rotation_angle_degrees) > 0.01
    x_length, y_length = math.hypot(a, b), math.hypot(c, d)
    if x_length and y_length and abs((a * c + b * d) / (x_length * y_length)) > 0.01:
        also = f" (and a {rotation_angle_degrees:.2f}° rotation)" if rotated else ""
        return TransformClassification(
            TransformKind.SKEW,
            f"has skew transformations{also}. Skew factors: b={b}, c={c}",
        )
    if rotated:
        return TransformClassification(
            TransformKind.ROTATION,
            f"has been rotated by {rotation_angle_degrees:.2f} degrees.",
        )
    return TransformClassification(TransformKind.NONE, "")
