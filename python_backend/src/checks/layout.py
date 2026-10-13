"""Checks on page layout: master pages, page items, bleed, text frames, object styles."""

from src.checks._report import at_frame, at_link, first_page_id, report
from src.document import ParsedDocument
from src.results.results import ValidationResult
from src.results.classifiers import ValidationError, ValidationWarning
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform


def masterpage_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error when a master spread holds anything besides its pages and properties (items on a master
    page)."""
    unexpected_elements = doc.masterspreads_parser.unexpected_elements
    if unexpected_elements:
        report(results, ValidationError.MASTERPAGE, 'Elements: ' + ', '.join(unexpected_elements), identifier=None)


def page_item_transformation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Same end-state rule as image_transformation_check, for text frames, image-less rectangles,
    ovals, polygons and groups: flip or skew -> error; rotation is fine."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for cand in spread.get_page_item_transform_candidates():
            tag = cand.get('tag') or 'Item'
            self_id = cand.get('self_id') or ''
            parsed = parse_item_transform(cand.get('item_transform') or '')
            if parsed is None:
                continue
            classification = classify_page_item_transform(*parsed[:4])
            if not classification.is_error:
                continue
            report(results, ValidationError.PAGE_ITEM_TRANSFORMATION, f"{tag} {classification.message}",
                   page_id=doc.find_page_id_from_data_id(self_id) if self_id else first_page_id(spread),
                   identifier=f"{tag}:{self_id}" if self_id else tag,
                   data_id=self_id or 'null')


def pasted_graphics_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each spread with graphics pasted into the document (PDF/EPS/image content without a
    link)."""
    for spread in doc.spreads_parser.spreads_obj_list:
        count = spread.pasted_graphics_num
        if count > 0:
            report(results, ValidationError.PASTED_GRAPHICS, f"{count} pasted graphics found.",
                   page_id=first_page_id(spread), identifier=None)


def document_bleed_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """One warning when any document bleed offset isn't 0."""
    bleed_values = doc.preferences_parser.document_bleed
    if bleed_values is not None and any(value != '0' for value in bleed_values.values()):
        descriptions = ', '.join(f"{k}: {v}pt" for k, v in bleed_values.items())
        report(results, ValidationWarning.DOCUMENT_BLEED, f"{descriptions}.", identifier=None)


def auto_size_text_box_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for auto-sizing text frames that won't behave the same in Frontify. Frontify always treats
    WidthOnly and HeightAndWidth as "No Line Breaks", so the InDesign frame must have it on to match.
    Every reference point is supported by Frontify, so it isn't checked (docs/checker-rules.md)."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for text_frame in spread.text_frame_obj_list:
            if not text_frame.is_auto_size:
                continue
            sizing = text_frame.auto_sizing_type
            no_line_breaks = text_frame.use_no_line_breaks
            if sizing in ('WidthOnly', 'HeightAndWidth'):
                message = "'No Line Breaks' must be checked." if not no_line_breaks or no_line_breaks == 'false' else None
            elif sizing == 'HeightOnly':
                message = None
            else:
                message = "Only width, height, and WidthAndHeight are supported."
            if message:
                report(results, ValidationError.AUTO_SIZE_TEXT_BOX, message, **at_frame(doc, text_frame))


def text_columns_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame with more than one column."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for text_frame in spread.text_frame_obj_list:
            columns = text_frame.text_column_count
            if columns and columns != '1':
                report(results, ValidationError.TEXT_COLUMNS, **at_frame(doc, text_frame))


def text_wrap_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each item with text wrap on: text frames (TEXT_WRAP), and images, shapes, lines and groups
    (TEXT_WRAP_ITEM), which is where wrap is usually set. Frontify ignores wrap, so text runs under the
    object. An item without wrap settings has none (InDesign's default)."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for text_frame in spread.text_frame_obj_list:
            mode = text_frame.text_wrap_mode
            if mode not in (None, 'None'):
                report(results, ValidationError.TEXT_WRAP, f"Text box wrap is '{mode}' not None.",
                       **at_frame(doc, text_frame))
        for item in spread.wrap_items:
            tag, self_id = item['tag'], item['self_id']
            report(results, ValidationError.TEXT_WRAP_ITEM, f"{tag} wrap is '{item['mode']}' not None.",
                   page_id=doc.find_page_id_from_data_id(self_id) if self_id else first_page_id(spread),
                   identifier=f"{tag}:{self_id}" if self_id else tag,
                   data_id=self_id or 'null')


def linked_text_frame_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame threaded to a previous or next frame."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for text_frame in spread.text_frame_obj_list:
            if text_frame.linked_text_frame:
                report(results, ValidationError.LINKED_TEXT_FRAME, **at_frame(doc, text_frame))


def object_style_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each text frame, and each placed image or its frame, using an object style other
    than InDesign's defaults."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for text_frame in spread.text_frame_obj_list:
            if text_frame.applied_object_style not in doc.default_object_styles:
                report(results, ValidationError.OBJECT_STYLE_TEXT, **{**at_frame(doc, text_frame), 'identifier': None})

    for spread in doc.spreads_parser.spreads_obj_list:
        for link in spread.links_obj_list:
            # The image and its frame each count: one error for each that has a custom object style.
            for style in (link.image_object_style, link.container_object_style):
                if style not in doc.default_object_styles:
                    report(results, ValidationError.OBJECT_STYLE_IMAGE, **at_link(doc, spread, link))
