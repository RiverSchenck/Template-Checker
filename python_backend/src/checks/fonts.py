"""Checks on fonts: included in the package, Adobe Fonts, OTF/TTF, variable fonts."""

from typing import List, Tuple

from src.checks._report import report
from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError


def _missing_styles(doc: ParsedDocument, font) -> Tuple[bool, List[str]]:
    """Whether a used family has no file in Document Fonts at all, and the styles the text uses (FontStyle
    names, 'Regular' when unset; for a family only paragraph styles name, theirs) that have no file. Styles are matched on PostScript name, which is what
    Frontify loads fonts by (the FontName in InDesign's AdobeFnt*.lst index). A style without a PostScript
    name in Fonts.xml counts as present when its family is."""
    document_fonts = doc.source_folders_parser.document_fonts
    used = sorted(doc.fonts_parser.faces_used_with(font.font_family))
    if font.font_family not in [document_font.font_family for document_font in document_fonts]:
        return True, used
    postscript_names = {document_font.postscript_name for document_font in document_fonts
                        if document_font.postscript_name}
    return False, [style for style in used
                   if (font.faces.get(style) or {}).get('postscript')
                   and font.faces[style]['postscript'] not in postscript_names]


def _is_adobe(font, style: str) -> bool:
    return bool((font.faces.get(style) or {}).get('typekit'))


def _report_missing(doc: ParsedDocument, results: ValidationResult, classifier, adobe: bool) -> None:
    """Missing fonts, split by where each style comes from: Adobe Fonts (adobe=True) or desktop fonts. A
    family with no file at all is reported once, under Adobe Fonts if any style the text uses is one; a
    partly packaged family names its missing styles."""
    for font in doc.fonts_parser.used_font_families:
        if font.variable_font:
            continue
        absent, missing = _missing_styles(doc, font)
        if absent:
            family_is_adobe = any(_is_adobe(font, style) for style in missing)
            if family_is_adobe == adobe:
                report(results, classifier, identifier=font.font_family)
            continue
        styles = [style for style in missing if _is_adobe(font, style) == adobe]
        if styles:
            report(results, classifier, f"Missing styles: {', '.join(styles)}", identifier=font.font_family)


def fonts_included_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each font family used in the document (Fonts.xml, via paragraph styles, character styles
    and text) whose files aren't in Document Fonts: the whole family, or some of the styles the text uses
    (named in the message). Variable fonts are skipped (variable_font_check reports them), and so are
    styles from Adobe Fonts (adobe_font_check reports them)."""
    _report_missing(doc, results, ValidationError.FONTS_INCLUDED, adobe=False)


def adobe_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for Adobe Fonts styles (a TypekitID in Fonts.xml) the text uses whose files aren't in Document
    Fonts, reported like fonts_included_check. Frontify never loads Adobe Fonts from Adobe, only from the
    package; InDesign packages them in some cases, and then they work like any other font."""
    _report_missing(doc, results, ValidationError.ADOBE_FONT, adobe=True)


def otf_ttf_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each file in Document Fonts that isn't .otf or .ttf."""
    for font in doc.source_folders_parser.document_fonts:
        extension = font.extension
        if extension.lower() not in ['.otf', '.ttf']:
            report(results, ValidationError.OTF_TTF_FONT, f"Font is {extension}", identifier=font.font_family)


def variable_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each variable font family the document uses."""
    for font in doc.fonts_parser.used_font_families:
        if font.variable_font:
            report(results, ValidationError.VARIABLE_FONT, identifier=font.font_family)
