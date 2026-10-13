"""Plain-language copy for every check: its name, why it matters in Frontify, and how to fix it in InDesign.

The only copy of this text. The customer summary uses it, and /run sends it to the web app (results.check_guides)
for the results view.
"""
from dataclasses import dataclass
from typing import Literal, Optional

SubjectKind = Literal['paragraph-style', 'character-style', 'font', 'image', 'frame', 'document']


@dataclass(frozen=True)
class CheckGuide:
    title: str
    """Short plain-language name of the problem."""
    why: str
    """What goes wrong in Frontify, in a sentence or two."""
    fix: tuple[str, ...]
    """How the template author fixes it in InDesign."""
    subject: SubjectKind
    """What the problem is tied to, which decides how its places are grouped."""


GUIDES: dict[str, dict[str, CheckGuide]] = {
    'errors': {
        'MASTERPAGE': CheckGuide(
            title='Items on a master page',
            why='Frontify only reads items on the document pages, so anything on a master page (called a parent page in newer InDesign versions) is ignored or breaks the template.',
            fix=(
                'In the Pages panel, open the master (parent) page and move its items onto the document pages, or delete them.',
            ),
            subject='document',
        ),
        'PARAGRAPH_STYLE': CheckGuide(
            title='Text without a paragraph style',
            why='Frontify uses paragraph styles to format text and decide what can be edited. Text set to [Basic Paragraph] or [No Paragraph Style] has nothing to follow.',
            fix=(
                'Select the text and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).',
            ),
            subject='frame',
        ),
        'PARAGRAPH_STYLE_TEXT_BOX': CheckGuide(
            title='Text frame has no paragraph style',
            why='Frontify uses paragraph styles to format text and decide what can be edited. This frame only uses the default style.',
            fix=(
                'Select the frame and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).',
            ),
            subject='frame',
        ),
        'FONTS_INCLUDED': CheckGuide(
            title='Font missing from the package',
            why='Frontify needs the font files to render the text, otherwise the template falls back to another font.',
            fix=(
                'Make sure the font is installed or activated on your computer.',
                'Package again with File > Package with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".',
            ),
            subject='font',
        ),
        'OTF_TTF_FONT': CheckGuide(
            title='Unsupported font format',
            why='Frontify can only use OpenType (.otf) and TrueType (.ttf) fonts. Other formats, such as Type 1, can’t be loaded.',
            fix=(
                'Get an OTF or TTF version from the font vendor and swap it in with Type > Find/Replace Font.',
            ),
            subject='font',
        ),
        'VARIABLE_FONT': CheckGuide(
            title='Variable font used',
            why='Frontify doesn’t support variable fonts, so text using them won’t render correctly.',
            fix=(
                'Install the static (non-variable) version of the font and swap it in with Type > Find/Replace Font.',
            ),
            subject='font',
        ),
        'IMAGE_INCLUDED': CheckGuide(
            title='Linked image missing from the package',
            why='The document links to an image that isn’t in the package, so Frontify can’t show it.',
            fix=(
                'Relink any missing images in Window > Links.',
                'Package again with File > Package with "Copy Linked Graphics" checked.',
            ),
            subject='image',
        ),
        'EMBEDDED_IMAGE': CheckGuide(
            title='Embedded image',
            why='Frontify needs images as separate linked files and can’t read images embedded in the document.',
            fix=(
                'In Window > Links, select the image and choose Unembed Link from the panel menu.',
                'Save it into the Links folder and package again.',
            ),
            subject='image',
        ),
        'IMAGE_TRANSFORMATION_IMAGE': CheckGuide(
            title='Image is flipped or skewed',
            why='Frontify can’t reproduce flipped or skewed images, so they’ll look different or break when edited.',
            fix=(
                'Double-click to select the image inside the frame, then choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
                'If you need the flipped look, save a flipped copy of the image file instead.',
            ),
            subject='image',
        ),
        'IMAGE_TRANSFORMATION_CONTAINER': CheckGuide(
            title='Image frame is flipped or skewed',
            why='Frontify can’t reproduce flipped or skewed frames, so the image will look different or break when edited.',
            fix=(
                'Select the image frame and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
            ),
            subject='image',
        ),
        'PAGE_ITEM_TRANSFORMATION': CheckGuide(
            title='Item is flipped or skewed',
            why='Frontify can’t reproduce flipped or skewed items, so they’ll look different from the InDesign file.',
            fix=(
                'Select the item and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
            ),
            subject='frame',
        ),
        'TABLE': CheckGuide(
            title='Table in a text frame',
            why='Frontify doesn’t support InDesign tables.',
            fix=(
                'Click into the table and choose Table > Convert Table to Text, or rebuild it with separate text frames.',
            ),
            subject='frame',
        ),
        'PASTED_GRAPHICS': CheckGuide(
            title='Pasted graphic',
            why='Graphics pasted straight into InDesign aren’t linked files, so Frontify can’t read them.',
            fix=(
                'Save the graphic as a file (for example SVG, PDF or PNG), delete the pasted version and place the file with File > Place.',
            ),
            subject='document',
        ),
        'AUTO_SIZE_TEXT_BOX': CheckGuide(
            title='Auto-size text frame set up incorrectly',
            why='Frontify grows auto-size frames as people type, and can’t match how these settings resize the frame.',
            fix=(
                'For each frame, open Object > Text Frame Options > Auto-Size and make the change noted next to it.',
            ),
            subject='frame',
        ),
        'TEXT_COLUMNS': CheckGuide(
            title='Text frame has columns',
            why='Frontify doesn’t support multiple columns inside one text frame.',
            fix=(
                'Set Columns to 1 in Object > Text Frame Options. Use separate text frames if you need columns.',
            ),
            subject='frame',
        ),
        'LINKED_TEXT_FRAME': CheckGuide(
            title='Threaded (linked) text frames',
            why='Frontify doesn’t support text flowing from one frame into another.',
            fix=(
                'Turn on View > Extras > Show Text Threads, then double-click a frame’s out port to break the thread so each frame holds its own text.',
            ),
            subject='frame',
        ),
        'OBJECT_STYLE_TEXT': CheckGuide(
            title='Object style on a text frame',
            why='Frontify doesn’t apply object styles, so the frame will look different.',
            fix=(
                'Select the frame and apply [None] or [Basic Text Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',
            ),
            subject='frame',
        ),
        'OBJECT_STYLE_IMAGE': CheckGuide(
            title='Object style on an image frame',
            why='Frontify doesn’t apply object styles, so the frame will look different.',
            fix=(
                'Select the frame and apply [None] or [Basic Graphics Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',
            ),
            subject='image',
        ),
        'GRID_ALIGNMENT': CheckGuide(
            title='Text aligned to the baseline grid',
            why='Frontify doesn’t use InDesign’s baseline grid, so line spacing will change.',
            fix=(
                'In the paragraph style, go to Indents and Spacing and set Align to Grid to None.',
            ),
            subject='paragraph-style',
        ),
        'KERNING': CheckGuide(
            title='Kerning isn’t set to Metrics',
            why='Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
            fix=(
                'In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.',
            ),
            subject='paragraph-style',
        ),
        'KERNING_CHAR': CheckGuide(
            title='Kerning isn’t set to Metrics',
            why='Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
            fix=(
                'In the character style, go to Basic Character Formats and set Kerning to Metrics.',
            ),
            subject='character-style',
        ),
        'TEXT_WRAP': CheckGuide(
            title='Text wrap applied',
            why='Frontify doesn’t support text wrap, so text won’t flow around objects.',
            fix=(
                'Select the frame and choose No Text Wrap in Window > Text Wrap.',
            ),
            subject='frame',
        ),
        'FILL_TINT': CheckGuide(
            title='Text color tint isn’t 100%',
            why='Frontify shows text colors at full strength, so tinted text will look darker. This check is in beta and can be wrong.',
            fix=(
                'In the paragraph style, go to Character Color and set Tint to 100%.',
            ),
            subject='paragraph-style',
        ),
        'FILL_TINT_CHAR': CheckGuide(
            title='Text color tint isn’t 100%',
            why='Frontify shows text colors at full strength, so tinted text will look darker.',
            fix=(
                'In the character style, go to Character Color and set Tint to 100%.',
                'To keep the lighter color, make a tint swatch (Swatches panel > New Tint Swatch) and apply that instead.',
            ),
            subject='character-style',
        ),
        'TEXT_WRAP_ITEM': CheckGuide(
            title='Text wrap applied',
            why='Frontify doesn’t support text wrap, so text won’t flow around this object and will run underneath it.',
            fix=(
                'Select the image, shape or group and choose No Text Wrap in Window > Text Wrap.',
                'Then make room for it with the text frame’s size or insets instead.',
            ),
            subject='frame',
        ),
        'TEXT_POSITION': CheckGuide(
            title='Superscript or subscript text',
            why='Frontify doesn’t support superscript or subscript, so the text shows at full size on the baseline (for example ® or a footnote number).',
            fix=(
                'Set Position to Normal in the character style (Basic Character Formats) or in the Character panel.',
                'For symbols like ® or ™, use a smaller point size in a character style instead, or a font’s superscript glyphs.',
            ),
            subject='character-style',
        ),
        'ADOBE_FONT': CheckGuide(
            title='Adobe Font used',
            why='Adobe Fonts aren’t supported in Frontify templates (for licensing reasons), so the template falls back to another font.',
            fix=(
                'Install a desktop version of the font (OTF or TTF) that you’re licensed to use, and switch the text to it: Type > Find/Change Font, or update the paragraph and character styles.',
                'Package again with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".',
            ),
            subject='font',
        ),
    },
    'warnings': {
        'HYPHENATION': CheckGuide(
            title='Hyphenation is on',
            why='Browsers hyphenate differently from InDesign, so lines may break in different places.',
            fix=(
                'In the paragraph style, go to Hyphenation and uncheck Hyphenate.',
            ),
            subject='paragraph-style',
        ),
        'OVERRIDE': CheckGuide(
            title='Text formatted outside its paragraph style',
            why='Formatting added by hand on top of a paragraph style (shown as a + next to the style name) may be lost or look different in Frontify.',
            fix=(
                'Click into the text. A + after the style name in Window > Styles > Paragraph Styles means it has extra formatting.',
                'To remove it, select the text and click Clear Overrides at the bottom of the Paragraph Styles panel.',
                'To keep the look, update the style to match instead (right-click the style > Redefine Style), or use a character style for single words.',
            ),
            subject='frame',
        ),
        'UNUSED_IMAGE': CheckGuide(
            title='Unused images in the package',
            why='These files aren’t used in the document and only make the package bigger.',
            fix=(
                'Delete the unused files from the Links folder before zipping the package.',
            ),
            subject='image',
        ),
        'DOCUMENT_BLEED': CheckGuide(
            title='Document has bleed',
            why='Bleed is added to every export, which is right for print templates but usually unwanted for digital ones.',
            fix=(
                'For a digital template, set bleed to 0 in File > Document Setup > Bleed and Slug. For print templates, bleed is fine.',
            ),
            subject='document',
        ),
        'COMPOSER': CheckGuide(
            title='Paragraph Composer used',
            why='The Adobe Paragraph Composer breaks lines differently from browsers, so text may reflow in Frontify.',
            fix=(
                'In the paragraph style, go to Justification and set Composer to Adobe Single-line Composer.',
            ),
            subject='paragraph-style',
        ),
        'BASELINE_SHIFT': CheckGuide(
            title='Baseline shift used',
            why='Frontify doesn’t support baseline shift, so shifted text sits on the baseline.',
            fix=(
                'Set Baseline Shift to 0 pt in the character style (Advanced Character Formats) or in the Character panel.',
            ),
            subject='character-style',
        ),
    },
    'infos': {
        'EMPTY_TEXT_FRAME': CheckGuide(
            title='Empty text frame',
            why='Empty frames are allowed, but are often left over by accident.',
            fix=(
                'Delete the frame if it isn’t needed.',
            ),
            subject='frame',
        ),
        'LARGE_IMAGE': CheckGuide(
            title='Large image',
            why='Very large images slow down editing and exporting in Frontify.',
            fix=(
                'Reduce the image’s pixel size or file size if it doesn’t need to be this large.',
            ),
            subject='image',
        ),
    },
}


def get_check_guide(severity: str, key: str, label: Optional[str] = None, message: Optional[str] = None) -> CheckGuide:
    """The guide for a check, with a fallback for package and parsing errors (and checks added before their copy)."""
    guide = GUIDES.get(severity, {}).get(key)
    if guide:
        return guide
    return CheckGuide(title=label or message or key, why=message or '', fix=(), subject='document')
