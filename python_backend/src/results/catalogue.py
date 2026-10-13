"""The catalogue: every check the checker runs, with the only copy of its wording (plan §4.4, D2).

One entry per check (v2 keys, plan §3.1): how severe it is, what kinds of thing it's about, a short title, why it
matters in Frontify, how to fix it in InDesign (per kind of thing when the steps differ), and its help article.
The customer summary, the web app (check guides), the results' list of checks and analytics all read it.

Until results v2 (plan PR 5.2) checks report v1 classifiers (src/results/classifiers.py); V1_KEYS maps each to its
entry and the kind of thing it's about.
"""
from dataclasses import dataclass
from typing import Dict, Mapping, Optional, Tuple, Type

from src.results.classifiers import Severity
from src.results.facts import (AutoSizeFacts, BleedFacts, Facts, InheritedFacts, MasterPageFacts, MissingFontFacts,
                                OverrideFacts, ParagraphStyleFacts, SizeFacts, TransformationFacts)

HELP_ARTICLE = 'https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates'


def article(anchor: str) -> str:
    """A section of the "Prepare InDesign documents for templates" help article."""
    return f'{HELP_ARTICLE}#{anchor}'


@dataclass(frozen=True)
class Entry:
    key: str
    severity: Severity
    subject_kinds: Tuple[str, ...]  # paragraph_style, character_style, text_frame, image, image_frame, font, page_item, document
    title: str                      # short plain-language name of the problem
    why: str                        # what goes wrong in Frontify
    fix: Mapping[str, Tuple[str, ...]]  # steps in InDesign, by subject kind ('*' when they're the same for every kind)
    help_article: Optional[str] = None
    is_check: bool = True           # False for package and parsing failures: not listed among the checks a template passed
    facts: Optional[Type[Facts]] = None  # the model of the facts its issues record (src/results/facts.py), if any

    def fix_for(self, kind: str) -> Tuple[str, ...]:
        return self.fix.get(kind) or self.fix.get('*') or ()


def _entry(key, severity, kinds, title, why, fix, help_article=None, is_check=True, facts=None) -> Entry:
    return Entry(key, severity, tuple(kinds.split()), title, why, fix if isinstance(fix, dict) else {'*': fix},
                 help_article, is_check, facts)


E, W, I = Severity.ERROR, Severity.WARNING, Severity.INFO
_CLEAR_TRANSFORMATIONS = 'choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).'

ENTRIES: Tuple[Entry, ...] = (
    # --- package and parsing failures (not checks) --------------------------------------------------------------
    _entry('ERROR', E, 'document', 'Error', 'Error', (), is_check=False),
    _entry('IDML', E, 'document', 'IDML', 'IDML error', (), is_check=False),
    _entry('ZIP', E, 'document', 'ZIP file error', 'ZIP file error', (),
           'https://help.frontify.com/en/articles/5306557-what-input-formats-do-digital-and-print-templates-support',
           is_check=False),
    _entry('WARNING', W, 'document', 'WARNING', '', (), is_check=False),

    # --- errors ("Blockers") -----------------------------------------------------------------------------------------
    _entry('MASTERPAGE', E, 'document', 'Items on a master page',
           'Frontify only reads items on the document pages, so anything on a master page (called a parent page in newer InDesign versions) is ignored or breaks the template.',
           ('In the Pages panel, open the master (parent) page and move its items onto the document pages, or delete them.',),
           article('h_4bef512504'), facts=MasterPageFacts),
    _entry('PARAGRAPH_STYLE', E, 'text_frame', 'Text without a paragraph style',
           'Frontify uses paragraph styles to format text and decide what can be edited. Text set to [Basic Paragraph] or [No Paragraph Style] has nothing to follow.',
           ('Select the text (or the whole frame) and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).',),
           article('h_68e2603775'), facts=ParagraphStyleFacts),
    _entry('FONTS_INCLUDED', E, 'font', 'Font missing from the package',
           'Frontify needs the font files to render the text, otherwise the template falls back to another font.',
           ('Make sure the font is installed or activated on your computer.',
            'Package again with File > Package with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".'),
           article('h_a3094cd981'), facts=MissingFontFacts),
    _entry('OTF_TTF_FONT', E, 'font', 'Unsupported font format',
           'Frontify can only use OpenType (.otf) and TrueType (.ttf) fonts. Other formats, such as Type 1, can’t be loaded.',
           ('Get an OTF or TTF version from the font vendor and swap it in with Type > Find/Replace Font.',),
           article('h_a3094cd981')),
    _entry('VARIABLE_FONT', E, 'font', 'Variable font used',
           'Frontify doesn’t support variable fonts, so text using them won’t render correctly.',
           ('Install the static (non-variable) version of the font and swap it in with Type > Find/Replace Font.',),
           article('h_a3094cd981')),
    _entry('IMAGE_INCLUDED', E, 'image', 'Linked image missing from the package',
           'The document links to an image that isn’t in the package, so Frontify can’t show it.',
           ('Relink any missing images in Window > Links.',
            'Package again with File > Package with "Copy Linked Graphics" checked.'),
           article('h_eba8d9b8c1')),
    _entry('EMBEDDED_IMAGE', E, 'image', 'Embedded image',
           'Frontify needs images as separate linked files and can’t read images embedded in the document.',
           ('In Window > Links, select the image and choose Unembed Link from the panel menu.',
            'Save it into the Links folder and package again.'),
           article('h_889cff064d')),
    _entry('TRANSFORMATION', E, 'image image_frame page_item', 'Item is flipped or skewed',
           'Frontify can’t reproduce flipped or skewed items, so they’ll look different or break when edited.',
           {'image': ('Double-click to select the image inside the frame, then ' + _CLEAR_TRANSFORMATIONS,
                      'If you need the flipped look, save a flipped copy of the image file instead.'),
            'image_frame': ('Select the image frame and ' + _CLEAR_TRANSFORMATIONS,),
            'page_item': ('Select the item and ' + _CLEAR_TRANSFORMATIONS,)},
           article('h_1205c11ca4'), facts=TransformationFacts),
    _entry('TABLE', E, 'text_frame', 'Table in a text frame', 'Frontify doesn’t support InDesign tables.',
           ('Click into the table and choose Table > Convert Table to Text, or rebuild it with separate text frames.',),
           article('h_b333040b53')),
    _entry('PASTED_GRAPHICS', E, 'document', 'Pasted graphic',
           'Graphics pasted straight into InDesign aren’t linked files, so Frontify can’t read them.',
           ('Save the graphic as a file (for example SVG, PDF or PNG), delete the pasted version and place the file with File > Place.',),
           article('h_889cff064d')),
    _entry('AUTO_SIZE_TEXT_BOX', E, 'text_frame', 'Auto-size text frame set up incorrectly',
           'Frontify grows auto-size frames as people type, and can’t match how these settings resize the frame.',
           ('For each frame, open Object > Text Frame Options > Auto-Size and make the change noted next to it.',),
           article('h_e69bd3114b'), facts=AutoSizeFacts),
    _entry('TEXT_COLUMNS', E, 'text_frame', 'Text frame has columns',
           'Frontify doesn’t support multiple columns inside one text frame.',
           ('Set Columns to 1 in Object > Text Frame Options. Use separate text frames if you need columns.',),
           article('h_2ea0534af5')),
    _entry('LINKED_TEXT_FRAME', E, 'text_frame', 'Threaded (linked) text frames',
           'Frontify doesn’t support text flowing from one frame into another.',
           ('Turn on View > Extras > Show Text Threads, then double-click a frame’s out port to break the thread so each frame holds its own text.',),
           article('h_befb8c0698')),
    _entry('OBJECT_STYLE', E, 'text_frame image', 'Object style applied',
           'Frontify doesn’t apply object styles, so the frame will look different.',
           {'text_frame': ('Select the frame and apply [None] or [Basic Text Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',),
            'image': ('Select the frame and apply [None] or [Basic Graphics Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',)},
           article('h_a92f4cebdf')),
    _entry('GRID_ALIGNMENT', E, 'paragraph_style', 'Text aligned to the baseline grid',
           'Frontify doesn’t use InDesign’s baseline grid, so line spacing will change.',
           ('In the paragraph style, go to Indents and Spacing and set Align to Grid to None.',),
           article('h_f6aa8d5242'), facts=InheritedFacts),
    _entry('KERNING', E, 'paragraph_style', 'Kerning isn’t set to Metrics',
           'Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
           ('In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.',),
           article('h_270ad57d8d'), facts=InheritedFacts),
    _entry('KERNING_CHAR', E, 'character_style', 'Kerning isn’t set to Metrics',
           'Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
           ('In the character style, go to Basic Character Formats and set Kerning to Metrics.',),
           article('h_270ad57d8d'), facts=InheritedFacts),
    _entry('TEXT_WRAP', E, 'text_frame page_item', 'Text wrap applied',
           'Frontify doesn’t support text wrap, so text won’t flow around objects and will run underneath them.',
           {'text_frame': ('Select the frame and choose No Text Wrap in Window > Text Wrap.',),
            'page_item': ('Select the image, shape or group and choose No Text Wrap in Window > Text Wrap.',
                          'Then make room for it with the text frame’s size or insets instead.')},
           article('h_0882abae12')),
    _entry('FILL_TINT', E, 'paragraph_style', 'Text color tint isn’t 100%',
           'Frontify shows text colors at full strength, so tinted text will look darker.',
           ('In the paragraph style, go to Character Color and set Tint to 100%.',),
           article('h_5cc6e214cf'), facts=InheritedFacts),
    _entry('FILL_TINT_CHAR', E, 'character_style', 'Text color tint isn’t 100%',
           'Frontify shows text colors at full strength, so tinted text will look darker.',
           ('In the character style, go to Character Color and set Tint to 100%.',
            'To keep the lighter color, make a tint swatch (Swatches panel > New Tint Swatch) and apply that instead.'),
           article('h_5cc6e214cf'), facts=InheritedFacts),
    _entry('TEXT_POSITION', E, 'character_style', 'Superscript or subscript text',
           'Frontify doesn’t support superscript or subscript, so the text shows at full size on the baseline (for example ® or a footnote number).',
           ('Set Position to Normal in the character style (Basic Character Formats) or in the Character panel.',
            'For symbols like ® or ™, use a smaller point size in a character style instead, or a font’s superscript glyphs.'),
           article('h_85811f039b'), facts=InheritedFacts),
    _entry('ADOBE_FONT', E, 'font', 'Adobe Font used',
           'Adobe Fonts aren’t supported in Frontify templates (for licensing reasons), so the template falls back to another font.',
           ('Install a desktop version of the font (OTF or TTF) that you’re licensed to use, and switch the text to it: Type > Find/Change Font, or update the paragraph and character styles.',
            'Package again with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".'),
           article('h_a3094cd981'), facts=MissingFontFacts),

    # --- warnings (may look different) ---------------------------------------------------------------------------
    _entry('HYPHENATION', W, 'paragraph_style', 'Hyphenation is on',
           'Browsers hyphenate differently from InDesign, so lines may break in different places.',
           ('In the paragraph style, go to Hyphenation and uncheck Hyphenate.',),
           article('h_55fa4b04cf'), facts=InheritedFacts),
    _entry('OVERRIDE', W, 'text_frame', 'Text formatted outside its paragraph style',
           'Formatting added by hand on top of a paragraph style (shown as a + next to the style name) may be lost or look different in Frontify.',
           ('Click into the text. A + after the style name in Window > Styles > Paragraph Styles means it has extra formatting.',
            'To remove it, select the text and click Clear Overrides at the bottom of the Paragraph Styles panel.',
            'To keep the look, update the style to match instead (right-click the style > Redefine Style), or use a character style for single words.'),
           article('h_68e2603775'), facts=OverrideFacts),
    _entry('UNUSED_IMAGE', W, 'image', 'Unused images in the package',
           'These files aren’t used in the document and only make the package bigger.',
           ('Delete the unused files from the Links folder before zipping the package.',),
           article('h_66fcd1c2c2')),
    _entry('DOCUMENT_BLEED', W, 'document', 'Document has bleed',
           'Bleed is added to every export, which is right for print templates but usually unwanted for digital ones.',
           ('For a digital template, set bleed to 0 in File > Document Setup > Bleed and Slug. For print templates, bleed is fine.',),
           'https://help.frontify.com/en/articles/8519462-bleed-settings-and-pdf-presets-for-digital-print-templates-indesign-based',
           facts=BleedFacts),
    _entry('COMPOSER', W, 'paragraph_style', 'Paragraph Composer used',
           'The Adobe Paragraph Composer breaks lines differently from browsers, so text may reflow in Frontify.',
           ('In the paragraph style, go to Justification and set Composer to Adobe Single-line Composer.',),
           article('h_bfdd4bceb0'), facts=InheritedFacts),
    _entry('BASELINE_SHIFT', W, 'character_style', 'Baseline shift used',
           'Frontify doesn’t support baseline shift, so shifted text sits on the baseline.',
           ('Set Baseline Shift to 0 pt in the character style (Advanced Character Formats) or in the Character panel.',),
           article('h_85811f039b'), facts=InheritedFacts),

    # --- infos (worth a check) ---------------------------------------------------------------------------------
    _entry('EMPTY_TEXT_FRAME', I, 'text_frame', 'Empty text frame',
           'Empty frames are allowed, but are often left over by accident.',
           ('Delete the frame if it isn’t needed.',),
           article('h_68e2603775')),
    _entry('LARGE_IMAGE', I, 'image', 'Large image',
           'Very large images slow down editing and exporting in Frontify.',
           ('Reduce the image’s pixel size or file size if it doesn’t need to be this large.',),
           article('h_66fcd1c2c2'), facts=SizeFacts),
)

BY_KEY: Dict[str, Entry] = {entry.key: entry for entry in ENTRIES}

# v1 classifier -> (catalogue entry, the kind of thing it reports). Only the merged checks (plan §3.1) differ.
V1_KEYS: Dict[str, Tuple[str, str]] = {
    'TEXT_WRAP': ('TEXT_WRAP', 'text_frame'),
    'TEXT_WRAP_ITEM': ('TEXT_WRAP', 'page_item'),
    'OBJECT_STYLE_TEXT': ('OBJECT_STYLE', 'text_frame'),
    'OBJECT_STYLE_IMAGE': ('OBJECT_STYLE', 'image'),
    'IMAGE_TRANSFORMATION_IMAGE': ('TRANSFORMATION', 'image'),
    'IMAGE_TRANSFORMATION_CONTAINER': ('TRANSFORMATION', 'image_frame'),
    'PAGE_ITEM_TRANSFORMATION': ('TRANSFORMATION', 'page_item'),
    'PARAGRAPH_STYLE': ('PARAGRAPH_STYLE', 'text_frame'),
    'PARAGRAPH_STYLE_TEXT_BOX': ('PARAGRAPH_STYLE', 'text_frame'),
    **{entry.key: (entry.key, entry.subject_kinds[0]) for entry in ENTRIES
       if entry.key not in ('TEXT_WRAP', 'OBJECT_STYLE', 'TRANSFORMATION', 'PARAGRAPH_STYLE')},
}


# The web app (results v1 until plan PR 5.3) and analytics (v1 keys until PR 5.4) still list the split v1 keys of a
# merged check as separate problems; they keep their own titles there so nothing lists the same title twice
# (River, 2026-10-13). The customer summary reads v2, where they're one check.
_V1_TITLES = {
    'PARAGRAPH_STYLE_TEXT_BOX': 'Text frame has no paragraph style',
    'OBJECT_STYLE_TEXT': 'Object style on a text frame',
    'OBJECT_STYLE_IMAGE': 'Object style on an image frame',
    'IMAGE_TRANSFORMATION_IMAGE': 'Image is flipped or skewed',
    'IMAGE_TRANSFORMATION_CONTAINER': 'Image frame is flipped or skewed',
}


def for_v1(name: str) -> Optional[Tuple[Entry, str]]:
    """(entry, subject kind) for a v1 classifier name, or None for one that no longer exists."""
    key, kind = V1_KEYS.get(name, (None, None))
    return (BY_KEY[key], kind) if key else None


def v1_names(key: str) -> Tuple[str, ...]:
    """The v1 classifiers a check was split into (or its own name), for what still speaks v1."""
    return tuple(name for name, (entry_key, _) in V1_KEYS.items() if entry_key == key)


def v1_name(key: str, kind: str, facts: Optional[dict] = None) -> str:
    """The v1 classifier a v2 issue was reported as: its check and the kind of thing it's about tell them apart,
    and for PARAGRAPH_STYLE (both about text frames) whether the whole frame is unstyled. A key the catalogue
    doesn't know is its own name."""
    if key == 'PARAGRAPH_STYLE':
        return 'PARAGRAPH_STYLE_TEXT_BOX' if (facts or {}).get('whole_frame') else 'PARAGRAPH_STYLE'
    return next((name for name, found in V1_KEYS.items() if found == (key, kind)), key)


def v1_title(name: str) -> str:
    """The title a v1 classifier is shown with (its entry's, or its own until results v2)."""
    return _V1_TITLES.get(name) or for_v1(name)[0].title
