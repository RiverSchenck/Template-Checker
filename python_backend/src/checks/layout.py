"""Checks on page layout: master pages, page items, bleed, text frames, object styles."""

from src.checks._report import at_frame, at_item, at_link, first_page_id, report
from src.model.document import Document
from src.results.results import Results
from src.results.classifiers import ValidationError, ValidationWarning
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform

TRANSFORMED_KINDS = frozenset({'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'Group'})
WRAP_ITEM_KINDS = frozenset({'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'})


def masterpage_check(doc: Document, results: Results) -> None:
    """Error when a master spread holds anything besides its pages and properties (items on a master
    page)."""
    unexpected_elements = [tag for master in doc.masters for tag in master.child_tags if tag not in ('Properties', 'Page')]
    if unexpected_elements:
        report(results, ValidationError.MASTERPAGE, 'Elements: ' + ', '.join(unexpected_elements), identifier=None)


def page_item_transformation_check(doc: Document, results: Results) -> None:
    """Same end-state rule as image_transformation_check, for text frames, image-less rectangles,
    ovals, polygons and groups: flip or skew -> error; rotation is fine."""
    for spread in doc.spreads:
        for item in spread.items:
            if item.kind not in TRANSFORMED_KINDS or (item.kind == 'Rectangle' and item.has_link):
                continue
            parsed = parse_item_transform(item.transform or '')
            if parsed is None:
                continue
            classification = classify_page_item_transform(*parsed[:4])
            if classification.is_error:
                report(results, ValidationError.PAGE_ITEM_TRANSFORMATION, f"{item.kind} {classification.message}",
                       **at_item(doc, spread, item))


def pasted_graphics_check(doc: Document, results: Results) -> None:
    """Error for each spread with graphics pasted into the document (PDF/EPS/image content without a
    link)."""
    for spread in doc.spreads:
        count = sum(1 for item in spread.items if item.pasted)
        if count > 0:
            report(results, ValidationError.PASTED_GRAPHICS, f"{count} pasted graphics found.",
                   page_id=first_page_id(spread), identifier=None)


def document_bleed_check(doc: Document, results: Results) -> None:
    """One warning when any document bleed offset isn't 0."""
    bleed_values = doc.bleed
    if bleed_values is not None and any(value != '0' for value in bleed_values.values()):
        descriptions = ', '.join(f"{k}: {v}pt" for k, v in bleed_values.items())
        report(results, ValidationWarning.DOCUMENT_BLEED, f"{descriptions}.", identifier=None)


def auto_size_text_box_check(doc: Document, results: Results) -> None:
    """Error for auto-sizing text frames that won't behave the same in Frontify. Frontify always treats
    WidthOnly and HeightAndWidth as "No Line Breaks", so the InDesign frame must have it on to match.
    Every reference point is supported by Frontify, so it isn't checked (docs/checker-rules.md)."""
    for _, frame in doc.text_frames():
        sizing = frame.auto_size
        if not sizing or sizing == 'Off':
            continue
        no_line_breaks = frame.no_line_breaks
        if sizing in ('WidthOnly', 'HeightAndWidth'):
            message = "'No Line Breaks' must be checked." if not no_line_breaks or no_line_breaks == 'false' else None
        elif sizing == 'HeightOnly':
            message = None
        else:
            message = "Only width, height, and WidthAndHeight are supported."
        if message:
            report(results, ValidationError.AUTO_SIZE_TEXT_BOX, message, **at_frame(doc, frame))


def text_columns_check(doc: Document, results: Results) -> None:
    """Error for each text frame with more than one column."""
    for _, frame in doc.text_frames():
        if frame.columns and frame.columns != '1':
            report(results, ValidationError.TEXT_COLUMNS, **at_frame(doc, frame))


def text_wrap_check(doc: Document, results: Results) -> None:
    """Error for each item with text wrap on: text frames (TEXT_WRAP), and images, shapes, lines and groups
    (TEXT_WRAP_ITEM), which is where wrap is usually set. Frontify ignores wrap, so text runs under the
    object. An item without wrap settings has none (InDesign's default)."""
    for spread in doc.spreads:
        for frame in spread.text_frames:
            if frame.wrap not in (None, 'None'):
                report(results, ValidationError.TEXT_WRAP, f"Text box wrap is '{frame.wrap}' not None.",
                       **at_frame(doc, frame))
        for item in spread.items:
            if item.kind in WRAP_ITEM_KINDS and item.wrap not in (None, 'None'):
                report(results, ValidationError.TEXT_WRAP_ITEM, f"{item.kind} wrap is '{item.wrap}' not None.",
                       **at_item(doc, spread, item))


def linked_text_frame_check(doc: Document, results: Results) -> None:
    """Error for each text frame threaded to a previous or next frame."""
    for _, frame in doc.text_frames():
        if frame.previous_frame != 'n' or frame.next_frame != 'n':
            report(results, ValidationError.LINKED_TEXT_FRAME, **at_frame(doc, frame))


def object_style_check(doc: Document, results: Results) -> None:
    """Error for each text frame, and each placed image or its frame, using an object style other
    than InDesign's defaults."""
    for _, frame in doc.text_frames():
        if frame.object_style not in doc.default_object_styles:
            report(results, ValidationError.OBJECT_STYLE_TEXT, **{**at_frame(doc, frame), 'identifier': None})

    for spread, link in doc.links():
        # The image and its frame each count: one error for each that has a custom object style.
        for style in (link.graphic_object_style, link.frame_object_style):
            if style not in doc.default_object_styles:
                report(results, ValidationError.OBJECT_STYLE_IMAGE, **at_link(doc, spread, link))
