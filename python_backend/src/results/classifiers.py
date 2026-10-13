"""Every issue the checker can report in results v1: its severity and the results section it's listed in.

The wording (title, why, fix, help link) is in the catalogue (src/results/catalogue.py), the only copy of it.
To add an issue, add its entry to the catalogue and a line in the class for its severity below:

    TEXT_WRAP = _issue(Category.TEXT_BOX)

reads as: an error (class ValidationError) reported under Text Boxes. Checks report it with
`report(results, ValidationError.TEXT_WRAP, ...)`.
"""
from dataclasses import dataclass, replace
from enum import Enum
from typing import Iterator, List, Optional


class Severity(Enum):
    """How serious an issue is. The value is the issue list it's reported in."""
    ERROR = 'errors'
    WARNING = 'warnings'
    INFO = 'infos'


class Category(Enum):
    """What an issue is about. The value is its section in the results JSON."""
    PAR_STYLE = 'par_styles'
    CHAR_STYLE = 'char_styles'
    TEXT_BOX = 'text_boxes'
    FONTS = 'fonts'
    IMAGES = 'images'
    GENERAL = 'general'


@dataclass(frozen=True)
class Classifier:
    name: str
    severity: Severity
    category: Category
    one_per_range: bool = False
    """Reported once per text range (overrides): never merged with another issue at the same place, and the
    results show the range's text."""

    @property
    def value(self) -> str:
        """The name the results JSON and analytics use for it."""
        return self.name

    @property
    def shows_text(self) -> bool:
        """Whether its results entries carry the text they're about (styles, and per-range issues)."""
        return self.category in (Category.PAR_STYLE, Category.CHAR_STYLE) or self.one_per_range


def _issue(category: Category, *, one_per_range: bool = False) -> Classifier:
    """One classifier. Its name and severity are filled in by @_severity from the class it's defined in."""
    return Classifier('', Severity.ERROR, category, one_per_range)


_ALL: List[Classifier] = []


def _severity(severity: Severity):
    """Give every classifier in the class its attribute name and this severity, and register it."""
    def decorate(cls):
        for name, value in list(vars(cls).items()):
            if isinstance(value, Classifier):
                classifier = replace(value, name=name, severity=severity)
                setattr(cls, name, classifier)
                _ALL.append(classifier)
        return cls
    return decorate


def all_classifiers() -> Iterator[Classifier]:
    """Every classifier: errors, then warnings, then infos, each in the order defined below."""
    return iter(_ALL)


def find(name: str, severity: Optional[Severity] = None) -> Optional[Classifier]:
    """The classifier with this name (and severity, if given), or None for a name that no longer exists."""
    return next((c for c in _ALL if c.name == name and severity in (None, c.severity)), None)


@_severity(Severity.ERROR)
class ValidationError:
    """Problems that break the template or clearly won't match in Frontify (shown as "Blockers")."""

    # Package and parsing failures, not template checks.
    ERROR = _issue(Category.GENERAL)
    IDML = _issue(Category.GENERAL)
    ZIP = _issue(Category.GENERAL)

    MASTERPAGE = _issue(Category.GENERAL)
    PARAGRAPH_STYLE = _issue(Category.TEXT_BOX)
    PARAGRAPH_STYLE_TEXT_BOX = _issue(Category.TEXT_BOX)
    FONTS_INCLUDED = _issue(Category.FONTS)
    OTF_TTF_FONT = _issue(Category.FONTS)
    VARIABLE_FONT = _issue(Category.FONTS)
    IMAGE_INCLUDED = _issue(Category.IMAGES)
    EMBEDDED_IMAGE = _issue(Category.IMAGES)
    IMAGE_TRANSFORMATION_IMAGE = _issue(Category.IMAGES)
    IMAGE_TRANSFORMATION_CONTAINER = _issue(Category.IMAGES)
    PAGE_ITEM_TRANSFORMATION = _issue(Category.GENERAL)
    TABLE = _issue(Category.TEXT_BOX)
    PASTED_GRAPHICS = _issue(Category.IMAGES)
    AUTO_SIZE_TEXT_BOX = _issue(Category.TEXT_BOX)
    TEXT_COLUMNS = _issue(Category.TEXT_BOX)
    LINKED_TEXT_FRAME = _issue(Category.TEXT_BOX)
    OBJECT_STYLE_TEXT = _issue(Category.TEXT_BOX)
    OBJECT_STYLE_IMAGE = _issue(Category.IMAGES)
    GRID_ALIGNMENT = _issue(Category.PAR_STYLE)
    KERNING = _issue(Category.PAR_STYLE)
    KERNING_CHAR = _issue(Category.CHAR_STYLE)
    TEXT_WRAP = _issue(Category.TEXT_BOX)
    FILL_TINT = _issue(Category.PAR_STYLE)
    FILL_TINT_CHAR = _issue(Category.CHAR_STYLE)
    TEXT_WRAP_ITEM = _issue(Category.GENERAL)
    TEXT_POSITION = _issue(Category.CHAR_STYLE)
    ADOBE_FONT = _issue(Category.FONTS)


@_severity(Severity.WARNING)
class ValidationWarning:
    """Things that may look different in Frontify."""

    # Package and parsing failures, not template checks.
    WARNING = _issue(Category.GENERAL)

    HYPHENATION = _issue(Category.PAR_STYLE)
    OVERRIDE = _issue(Category.TEXT_BOX, one_per_range=True)
    UNUSED_IMAGE = _issue(Category.IMAGES)
    DOCUMENT_BLEED = _issue(Category.GENERAL)
    COMPOSER = _issue(Category.PAR_STYLE)
    BASELINE_SHIFT = _issue(Category.CHAR_STYLE)


@_severity(Severity.INFO)
class ValidationInfo:
    """Things worth a check."""

    EMPTY_TEXT_FRAME = _issue(Category.TEXT_BOX)
    LARGE_IMAGE = _issue(Category.IMAGES)
