"""Checks on fonts: included in the package, Adobe Fonts, OTF/TTF, variable fonts."""

from typing import List, Tuple

from src.checks._report import report
from src.model import subject as subjects
from src.model.assets import FontFamily
from src.model.document import Document
from src.results.results import Results


def _missing_styles(doc: Document, font: FontFamily) -> Tuple[bool, List[str]]:
    """Whether a used family has no file in Document Fonts at all, and the styles the text uses (FontStyle
    names, 'Regular' when unset; for a family only paragraph styles name, theirs) that have no file. Styles are matched on PostScript name, which is what
    Frontify loads fonts by (the FontName in InDesign's AdobeFnt*.lst index). A style without a PostScript
    name in Fonts.xml counts as present when its family is."""
    used = sorted(doc.faces_used_with(font.name))
    if font.name not in [packaged.family for packaged in doc.packaged_fonts]:
        return True, used
    postscript_names = {packaged.postscript_name for packaged in doc.packaged_fonts if packaged.postscript_name}
    return False, [style for style in used
                   if style in font.faces and font.faces[style].postscript
                   and font.faces[style].postscript not in postscript_names]


def _is_adobe(font: FontFamily, style: str) -> bool:
    return bool(style in font.faces and font.faces[style].typekit)


def _report_missing(doc: Document, results: Results, check: str, adobe: bool) -> None:
    """Missing fonts, split by where each style comes from: Adobe Fonts (adobe=True) or desktop fonts. A
    family with no file at all is reported once, under Adobe Fonts if any style the text uses is one; a
    partly packaged family names its missing styles."""
    for font in doc.used_fonts:
        if font.variable:
            continue
        absent, missing = _missing_styles(doc, font)
        if absent:
            family_is_adobe = any(_is_adobe(font, style) for style in missing)
            if family_is_adobe == adobe:
                report(results, check, subject=subjects.font(font.name),
                       context_details={'missing_styles': missing, 'whole_family': True})
            continue
        styles = [style for style in missing if _is_adobe(font, style) == adobe]
        if styles:
            report(results, check, f"Missing styles: {', '.join(styles)}", subject=subjects.font(font.name),
                   context_details={'missing_styles': styles, 'whole_family': False})


def fonts_included_check(doc: Document, results: Results) -> None:
    """Error for each font family used in the document (Fonts.xml, via paragraph styles, character styles
    and text) whose files aren't in Document Fonts: the whole family, or some of the styles the text uses
    (named in the message). Variable fonts are skipped (variable_font_check reports them), and so are
    styles from Adobe Fonts (adobe_font_check reports them)."""
    _report_missing(doc, results, 'FONTS_INCLUDED', adobe=False)


def adobe_font_check(doc: Document, results: Results) -> None:
    """Error for Adobe Fonts styles (a TypekitID in Fonts.xml) the text uses whose files aren't in Document
    Fonts, reported like fonts_included_check. Frontify never loads Adobe Fonts from Adobe, only from the
    package; InDesign packages them in some cases, and then they work like any other font."""
    _report_missing(doc, results, 'ADOBE_FONT', adobe=True)


def otf_ttf_font_check(doc: Document, results: Results) -> None:
    """Error for each file in Document Fonts that isn't .otf or .ttf."""
    for font in doc.packaged_fonts:
        if font.extension.lower() not in ['.otf', '.ttf']:
            report(results, 'OTF_TTF_FONT', f"Font is {font.extension}", subject=subjects.font(font.family))


def variable_font_check(doc: Document, results: Results) -> None:
    """Error for each variable font family the document uses."""
    for font in doc.used_fonts:
        if font.variable:
            report(results, 'VARIABLE_FONT', subject=subjects.font(font.name))
