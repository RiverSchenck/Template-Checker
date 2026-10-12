"""Checks on fonts: included in the package, OTF/TTF, variable fonts."""

from src.checks._report import report
from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError


def fonts_included_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each font family used in the document (Fonts.xml, via styles and text) that has no
    file in Document Fonts. Variable fonts are skipped (variable_font_check reports them). Compares
    family names only."""
    document_font_families = [font.get_font_family() for font in doc.source_folders_parser.get_document_fonts()]
    for font in doc.fonts_parser.get_used_font_families():
        if not font.is_variable_font() and font.get_font_family() not in document_font_families:
            report(results, ValidationError.FONTS_INCLUDED, identifier=font.get_font_family())


def otf_ttf_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each file in Document Fonts that isn't .otf or .ttf."""
    for font in doc.source_folders_parser.get_document_fonts():
        extension = font.get_extension()
        if extension.lower() not in ['.otf', '.ttf']:
            report(results, ValidationError.OTF_TTF_FONT, f"Font is {extension}", identifier=font.get_font_family())


def variable_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each variable font family the document uses."""
    for font in doc.fonts_parser.get_used_font_families():
        if font.is_variable_font():
            report(results, ValidationError.VARIABLE_FONT, identifier=font.get_font_family())
