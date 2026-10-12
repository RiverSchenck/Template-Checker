"""Checks on page layout: master pages, page items, bleed, text frames, object styles."""

from src.checks._report import at_frame, at_link, first_page_id, report
from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning
from src.helpers.page_item_transform import TransformKind, classify_page_item_transform, parse_item_transform


def masterpage_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error when a master spread holds anything besides its pages and properties (items on a master
    page)."""
    unexpected_elements = doc.masterspreads_parser.get_unexpected_elements()
    if unexpected_elements:
        report(results, ValidationError.MASTERPAGE, 'Elements: ' + ', '.join(unexpected_elements), identifier=None)


def page_item_transformation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Same end-state rule as image_transformation_check, for text frames, image-less rectangles,
    ovals, polygons and groups: flip or skew -> error, rotation only -> warning."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for cand in spread.get_page_item_transform_candidates():
            tag = cand.get('tag') or 'Item'
            self_id = cand.get('self_id') or ''
            parsed = parse_item_transform(cand.get('item_transform') or '')
            if parsed is None:
                continue
            classification = classify_page_item_transform(*parsed[:4])
            if classification.kind == TransformKind.NONE:
                continue
            # Flips and skews are errors; what's left is a rotation, a warning.
            classifier = (ValidationError.PAGE_ITEM_TRANSFORMATION if classification.is_error
                          else ValidationWarning.PAGE_ITEM_TRANSFORMATION)
            report(results, classifier, f"{tag} {classification.message}",
                   page_id=doc.find_page_id_from_data_id(self_id) if self_id else first_page_id(spread),
                   identifier=f"{tag}:{self_id}" if self_id else tag,
                   data_id=self_id or 'null')


def pasted_graphics_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each spread with graphics pasted into the document (PDF/EPS/image content without a
    link)."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        count = spread.get_pasted_graphics_num()
        if count > 0:
            report(results, ValidationError.PASTED_GRAPHICS, f"{count} pasted graphics found.",
                   page_id=first_page_id(spread), identifier=None)


def document_bleed_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """One warning when any document bleed offset isn't 0."""
    bleed_values = doc.preferences_parser.get_document_bleed()
    if bleed_values is not None and any(value != '0' for value in bleed_values.values()):
        descriptions = ', '.join(f"{k}: {v}pt" for k, v in bleed_values.items())
        report(results, ValidationWarning.DOCUMENT_BLEED, f"{descriptions}.", identifier=None)


# Reference points each auto-size type may grow from.
_HEIGHT_ONLY_POINTS = ['TopCenterPoint', 'BottomCenterPoint']
_WIDTH_ONLY_POINTS = ['LeftCenterPoint', 'RightCenterPoint']
_CORNER_POINTS = ['TopLeftPoint', 'BottomLeftPoint', 'BottomRightPoint', 'TopRightPoint']


def auto_size_text_box_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for auto-sizing text frames Frontify can't reproduce: HeightOnly must grow from the top
    or bottom center; WidthOnly and HeightAndWidth need "No Line Breaks", and grow from the
    left/right center or a corner respectively."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if not text_frame.get_is_auto_size():
                continue
            sizing = text_frame.get_auto_sizing_type()
            point = text_frame.get_auto_sizing_reference_point()
            no_line_breaks = text_frame.get_use_no_line_breaks()
            # InDesign moves the reference point when 'No Line Breaks' is off, so that's the only thing reported then.
            needs_no_line_breaks = sizing in ('WidthOnly', 'HeightAndWidth')
            if sizing == 'HeightOnly':
                message = "HeightOnly cannot autosize from center." if point not in _HEIGHT_ONLY_POINTS else None
            elif needs_no_line_breaks and (not no_line_breaks or no_line_breaks == 'false'):
                message = "'No Line Breaks' must be checked."
            elif sizing == 'WidthOnly':
                message = "WidthOnly cannot autosize from center." if point not in _WIDTH_ONLY_POINTS else None
            elif sizing == 'HeightAndWidth':
                message = "HeightAndWidth must auto size from corners." if point not in _CORNER_POINTS else None
            else:
                message = "Only width, height, and WidthAndHeight are supported."
            if message:
                report(results, ValidationError.AUTO_SIZE_TEXT_BOX, message, **at_frame(doc, text_frame))


def text_columns_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame with more than one column."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            columns = text_frame.get_text_column_count()
            if columns and columns != '1':
                report(results, ValidationError.TEXT_COLUMNS, **at_frame(doc, text_frame))


def text_wrap_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame with text wrap on. A frame without wrap settings has none
    (InDesign's default)."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            mode = text_frame.get_text_wrap_mode()
            if mode not in (None, 'None'):
                report(results, ValidationError.TEXT_WRAP, f"Text box wrap is '{mode}' not None.",
                       **at_frame(doc, text_frame))


def linked_text_frame_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame threaded to a previous or next frame."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_is_linked_text_frame():
                report(results, ValidationError.LINKED_TEXT_FRAME, **at_frame(doc, text_frame))


def object_style_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame, and each placed image or its frame, using an object style other
    than InDesign's defaults."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_applied_object_style() not in doc.default_object_styles:
                report(results, ValidationError.OBJECT_STYLE_TEXT, **{**at_frame(doc, text_frame), 'identifier': None})

    for spread in doc.spreads_parser.get_spreads_obj_list():
        for link in spread.get_links_obj_list():
            # The image and its frame each count: one error for each that has a custom object style.
            for style in (link.get_image_object_style(), link.get_container_object_style()):
                if style not in doc.default_object_styles:
                    report(results, ValidationError.OBJECT_STYLE_IMAGE, **at_link(doc, spread, link))
