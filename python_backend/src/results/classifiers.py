"""Every issue the checker can report: how severe it is, which results section it's listed in, and its copy.

To add one, write a line in the class for its severity below, then add its guide (title, why, fix) to
app/customer_summary/check_guides.py. Nothing else keys off the list: the results JSON, the list of checks the
frontend shows and analytics all read the classifier.

    TEXT_WRAP = _issue(Category.TEXT_BOX, 'Text Wrap', 'Text Wrap is not supported.', article('h_0882abae12'))

reads as: report it under Text Boxes, labelled "Text Wrap", with that message and a link to that section of the
help article. Checks report it with `report(results, ValidationError.TEXT_WRAP, ...)`.
"""
from dataclasses import dataclass, replace
from enum import Enum
from typing import Iterator, List, Optional

HELP_ARTICLE = 'https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates'


def article(anchor: str) -> str:
    """A section of the "Prepare InDesign documents for templates" help article."""
    return f'{HELP_ARTICLE}#{anchor}'


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
    label: Optional[str]
    message: Optional[str]
    help_article: Optional[str] = None
    is_check: bool = True
    """False for package and parsing failures: they aren't listed among the checks a template passed."""
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


def _issue(category: Category, label: Optional[str], message: Optional[str], help_article: Optional[str] = None, *,
           is_check: bool = True, one_per_range: bool = False) -> Classifier:
    """One classifier. Its name and severity are filled in by @_severity from the class it's defined in."""
    return Classifier('', Severity.ERROR, category, label, message, help_article, is_check, one_per_range)


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
    ERROR = _issue(Category.GENERAL, 'Error', 'Error', is_check=False)
    IDML = _issue(Category.GENERAL, 'IDML', 'IDML error', is_check=False)
    ZIP = _issue(
        Category.GENERAL,
        None,
        'ZIP file error',
        'https://help.frontify.com/en/articles/5306557-what-input-formats-do-digital-and-print-templates-support',
        is_check=False)

    MASTERPAGE = _issue(Category.GENERAL, 'Masterpage', "Master Page can't be used.", article('h_4bef512504'))
    PARAGRAPH_STYLE = _issue(
        Category.TEXT_BOX, 'Paragraph Style', 'Text found missing paragraph styles.', article('h_68e2603775'))
    PARAGRAPH_STYLE_TEXT_BOX = _issue(
        Category.TEXT_BOX, 'Paragraph Style', 'No paragraph styles were used.', article('h_68e2603775'))
    FONTS_INCLUDED = _issue(Category.FONTS, 'Fonts Included', 'Package is missing fonts.', article('h_a3094cd981'))
    OTF_TTF_FONT = _issue(
        Category.FONTS, 'OTF/TTF Font', 'Only OTF or TTF fonts are supported.', article('h_a3094cd981'))
    VARIABLE_FONT = _issue(
        Category.FONTS, 'Variable Font', 'Variable fonts are not supported', article('h_a3094cd981'))
    IMAGE_INCLUDED = _issue(
        Category.IMAGES, 'Images Included', 'Package missing image link.', article('h_eba8d9b8c1'))
    EMBEDDED_IMAGE = _issue(
        Category.IMAGES, 'Embedded Image', 'Embedded images are not supported.', article('h_889cff064d'))
    IMAGE_TRANSFORMATION_IMAGE = _issue(
        Category.IMAGES,
        'Image Transformation (Image)',
        'Image transformations are not supported.',
        article('h_1205c11ca4'))
    IMAGE_TRANSFORMATION_CONTAINER = _issue(
        Category.IMAGES,
        'Image Transformation (Container)',
        'Image transformations are not supported.',
        article('h_1205c11ca4'))
    PAGE_ITEM_TRANSFORMATION = _issue(
        Category.GENERAL,
        'Page Item Transformation',
        'Page item transformations (flip/skew) are not supported.',
        article('h_1205c11ca4'))
    TABLE = _issue(Category.TEXT_BOX, 'Table', 'Tables are not supported', article('h_b333040b53'))
    PASTED_GRAPHICS = _issue(
        Category.IMAGES, 'Pasted Graphics', 'Pasted graphics are not supported', article('h_889cff064d'))
    AUTO_SIZE_TEXT_BOX = _issue(
        Category.TEXT_BOX,
        'Auto Sizing Text Box',
        'Auto-size text boxes were not set up properly',
        article('h_e69bd3114b'))
    TEXT_COLUMNS = _issue(Category.TEXT_BOX, 'Text Column', 'Text columns are not supported', article('h_2ea0534af5'))
    LINKED_TEXT_FRAME = _issue(
        Category.TEXT_BOX,
        'Linked Text Frame',
        'Linked (threaded) text frames are not supported.',
        article('h_befb8c0698'))
    OBJECT_STYLE_TEXT = _issue(
        Category.TEXT_BOX, 'Object Style', 'Object styles are not supported.', article('h_a92f4cebdf'))
    OBJECT_STYLE_IMAGE = _issue(
        Category.IMAGES, 'Object Style', 'Object styles are not supported.', article('h_a92f4cebdf'))
    GRID_ALIGNMENT = _issue(
        Category.PAR_STYLE, 'Grid Alignment', 'Grid alignment is not supported', article('h_f6aa8d5242'))
    KERNING = _issue(Category.PAR_STYLE, 'Kerning', "Kerning must be 'Metrics'", article('h_270ad57d8d'))
    KERNING_CHAR = _issue(Category.CHAR_STYLE, 'Kerning', "Kerning must be 'Metrics'", article('h_270ad57d8d'))
    TEXT_WRAP = _issue(Category.TEXT_BOX, 'Text Wrap', 'Text Wrap is not supported.', article('h_0882abae12'))
    FILL_TINT = _issue(
        Category.PAR_STYLE,
        'Color Fill Tint (Beta)',
        'Fill Tint must be 100. (This may be inaccurate, testing currently)',
        article('h_5cc6e214cf'))
    FILL_TINT_CHAR = _issue(
        Category.CHAR_STYLE,
        'Color Fill Tint',
        'Fill Tint must be 100. Frontify shows text colours without their tint.',
        article('h_5cc6e214cf'))
    TEXT_WRAP_ITEM = _issue(
        Category.GENERAL, 'Text Wrap (Object)', 'Text Wrap is not supported.', article('h_0882abae12'))
    TEXT_POSITION = _issue(
        Category.CHAR_STYLE,
        'Superscript/Subscript',
        'Superscript and subscript are not supported.',
        article('h_85811f039b'))
    ADOBE_FONT = _issue(
        Category.FONTS,
        'Adobe Font',
        'Adobe Fonts are not supported. Use a desktop version of the font (OTF or TTF) instead.',
        article('h_a3094cd981'))


@_severity(Severity.WARNING)
class ValidationWarning:
    """Things that may look different in Frontify."""

    # Package and parsing failures, not template checks.
    WARNING = _issue(Category.GENERAL, None, None, is_check=False)

    HYPHENATION = _issue(Category.PAR_STYLE, 'Hyphenation', 'Hyphenation is not supported.', article('h_55fa4b04cf'))
    OVERRIDE = _issue(
        Category.TEXT_BOX, 'Override', 'Overrides are not supported.', article('h_68e2603775'), one_per_range=True)
    UNUSED_IMAGE = _issue(
        Category.IMAGES,
        'Unused Image',
        'Image(s) in package are unused making the package larger in size.',
        article('h_66fcd1c2c2'))
    DOCUMENT_BLEED = _issue(
        Category.GENERAL,
        'Document Bleed',
        'InDesign defined bleed is applied.',
        'https://help.frontify.com/en/articles/8519462-bleed-settings-and-pdf-presets-for-digital-print-templates-indesign-based')
    COMPOSER = _issue(
        Category.PAR_STYLE,
        'Composer',
        "We recommend defining paragraph style composers as 'Adobe Single-line Composer', as browsers can render this composer. Otherwise, discrepencies between export and editing may occur.",
        article('h_bfdd4bceb0'))
    BASELINE_SHIFT = _issue(
        Category.CHAR_STYLE,
        'Baseline Shift',
        'Baseline shift is not supported. Shifted text sits on the baseline in Frontify.',
        article('h_85811f039b'))


@_severity(Severity.INFO)
class ValidationInfo:
    """Things worth a check."""

    EMPTY_TEXT_FRAME = _issue(
        Category.TEXT_BOX, 'Empty Text Frames', 'Empty text frame found.', article('h_68e2603775'))
    LARGE_IMAGE = _issue(
        Category.IMAGES,
        'Large Image',
        'Image is large. Verify that this large of an image is needed.',
        article('h_66fcd1c2c2'))
