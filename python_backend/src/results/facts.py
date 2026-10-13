"""The structured facts each check records about an issue (results v2 `facts`, plan §4.3). The catalogue says which
model each check uses; consumers read these, never the display text."""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict


class Facts(BaseModel):
    model_config = ConfigDict(extra='forbid')


class InheritedFacts(Facts):
    """A style setting that comes from a style it's based on."""
    inherited_from: str
    """Self of the style that sets it."""


class AutoSizeFacts(Facts):
    auto_size: str
    """InDesign's AutoSizingType, e.g. WidthOnly."""
    no_line_breaks: bool


class SizeFacts(Facts):
    size_mb: float


class MasterElement(Facts):
    kind: str
    """The element's tag, e.g. Rectangle."""
    count: int


class MasterPageFacts(Facts):
    elements: List[MasterElement]
    """What's on the master pages, in the order found."""


class Bleed(Facts):
    """Offsets in points (may be negative); None when InDesign's value isn't a number."""
    top: Optional[float]
    bottom: Optional[float]
    inside: Optional[float]
    outside: Optional[float]


class BleedFacts(Facts):
    bleed: Bleed


class ParagraphStyleFacts(Facts):
    whole_frame: bool
    """The whole frame has no paragraph style (else one run of its text)."""
    whitespace_only: bool


class OverrideFacts(Facts):
    text: str
    overrides: Dict[str, str]
    """Property -> the value set on the text."""


class MissingFontFacts(Facts):
    missing_styles: List[str]
    whole_family: bool
    """No file of the family is in the package."""


class TransformationFacts(Facts):
    kind: Literal['flip', 'skew']
    rotation_deg: Optional[float]
    """None for a flip."""


ALL_FACTS = (InheritedFacts, AutoSizeFacts, SizeFacts, MasterPageFacts, BleedFacts, ParagraphStyleFacts,
             OverrideFacts, MissingFontFacts, TransformationFacts)
