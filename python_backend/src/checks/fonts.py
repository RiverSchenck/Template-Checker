"""Checks on fonts: included in the package, OTF/TTF, variable fonts."""

from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError


def fonts_included_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each font family used in the document (Fonts.xml, via styles and text) that has no
    file in Document Fonts. Variable fonts are skipped (variable_font_check reports them). Compares
    family names only."""
    # Currently only checking font families, not specific font.
    used_font_families_objects = doc.fonts_parser.get_used_font_families()
    # skip variable fonts
    used_font_families_names = [
        font_obj.get_font_family() for font_obj in used_font_families_objects if not font_obj.is_variable_font()]

    document_font_families = [font_obj.get_font_family(
    ) for font_obj in doc.source_folders_parser.get_document_fonts()]

    for used_font in used_font_families_names:
        if used_font not in document_font_families:

            # message = f"Font family '{used_font}' is used but not found in the document fonts."
            results.add_error(
                context=None,
                error_type=ValidationError.FONTS_INCLUDED,
                page_id='',
                identifier=used_font,
                data_id='null'
            )


def otf_ttf_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each file in Document Fonts that isn't .otf or .ttf."""
    # We could go further and map used fonts, to source fonts but this isn't needed because from XML we dont know fonts source (OTF, TTF, TTC). So we anyways dont get anything out of mapping.

    for font in doc.source_folders_parser.get_document_fonts():
        font_extension = font.get_extension()
        if font_extension.lower() not in ['.otf', '.ttf']:
            font_family = font.get_font_family()
            message = f"Font is {font_extension}"
            results.add_error(
                context=message,
                error_type=ValidationError.OTF_TTF_FONT,
                page_id='',
                identifier=font_family,
                data_id='null')


def variable_font_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each variable font family the document uses."""
    for font_obj in doc.fonts_parser.get_used_font_families():
        if font_obj.is_variable_font():
            font_family = font_obj.get_font_family()
            results.add_error(
                context=None,
                error_type=ValidationError.VARIABLE_FONT,
                page_id='',
                identifier=font_family,
                data_id='null')
