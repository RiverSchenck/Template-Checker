"""Checks on page layout: master pages, page items, bleed, text frames, object styles."""

from src.checks._report import at_frame, at_item, at_link, first_page_id, report
from src.model.document import Document
from src.results.results import Results
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform, transform_facts
from src.model.layout import GRAPHIC_FRAME_TAGS

TRANSFORMED_KINDS = frozenset({'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'Group'})
WRAP_ITEM_KINDS = frozenset({'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'})


def masterpage_check(doc: Document, results: Results) -> None:
    """Error when a master spread holds anything besides its pages and properties (items on a master
    page)."""
    unexpected_elements = [tag for master in doc.masters for tag in master.child_tags if tag not in ('Properties', 'Page')]
    if unexpected_elements:
        # A list, in the order they're found: JSON objects don't keep their keys' order.
        counts = [{'kind': tag, 'count': unexpected_elements.count(tag)} for tag in dict.fromkeys(unexpected_elements)]
        report(results, 'MASTERPAGE', 'Elements: ' + ', '.join(unexpected_elements),
               context_details={'elements': counts})


def page_item_transformation_check(doc: Document, results: Results) -> None:
    """Same end-state rule as image_transformation_check, for text frames, image-less rectangles,
    ovals and polygons, and groups: flip or skew -> error; rotation is fine. A frame holding an image is
    left to image_transformation_check (B5: it was reported twice)."""
    for spread, item in doc.page_items():
        if item.kind not in TRANSFORMED_KINDS or (item.kind in GRAPHIC_FRAME_TAGS and item.has_link):
            continue
        parsed = parse_item_transform(item.transform or '')
        if parsed is None:
            continue
        classification = classify_page_item_transform(*parsed[:4])
        if classification.is_error:
            report(results, 'TRANSFORMATION', f"{item.kind} {classification.message}",
                   context_details=transform_facts(classification, *parsed[:2]), **at_item(doc, spread, item))


def pasted_graphics_check(doc: Document, results: Results) -> None:
    """Error for each spread with graphics pasted into the document (PDF/EPS/image content without a
    link)."""
    pasted = [spread for spread, item in doc.page_items() if item.pasted]
    for spread in doc.spreads:
        count = pasted.count(spread)
        if count > 0:
            report(results, 'PASTED_GRAPHICS', f"{count} pasted graphics found.",
                   page_id=first_page_id(spread))


def _points(value):
    """A bleed offset in points (may be negative), None when it isn't a number."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def document_bleed_check(doc: Document, results: Results) -> None:
    """One warning when any document bleed offset isn't 0."""
    bleed_values = doc.bleed
    if bleed_values is not None and any(value != '0' for value in bleed_values.values()):
        descriptions = ', '.join(f"{k}: {v}pt" for k, v in bleed_values.items())
        report(results, 'DOCUMENT_BLEED', f"{descriptions}.",
               context_details={'bleed': {side: _points(value) for side, value in bleed_values.items()}})


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
            report(results, 'AUTO_SIZE_TEXT_BOX', message, **at_frame(doc, frame),
                   context_details={'auto_size': sizing, 'no_line_breaks': no_line_breaks == 'true'})


def text_columns_check(doc: Document, results: Results) -> None:
    """Error for each text frame with more than one column."""
    for _, frame in doc.text_frames():
        if frame.columns and frame.columns != '1':
            report(results, 'TEXT_COLUMNS', **at_frame(doc, frame))


def text_wrap_check(doc: Document, results: Results) -> None:
    """Error for each item with text wrap on: text frames (TEXT_WRAP), and images, shapes, lines and groups
    (TEXT_WRAP_ITEM), which is where wrap is usually set. Frontify ignores wrap, so text runs under the
    object. An item without wrap settings has none (InDesign's default)."""
    for _, frame in doc.text_frames():
        if frame.wrap not in (None, 'None'):
            report(results, 'TEXT_WRAP', f"Text box wrap is '{frame.wrap}' not None.",
                   **at_frame(doc, frame))
    for spread, item in doc.page_items():
        if item.kind in WRAP_ITEM_KINDS and item.wrap not in (None, 'None'):
            report(results, 'TEXT_WRAP', f"{item.kind} wrap is '{item.wrap}' not None.",
                   **at_item(doc, spread, item))


def linked_text_frame_check(doc: Document, results: Results) -> None:
    """Error for each text frame threaded to a previous or next frame. 'n' or no attribute means none (B8: a frame
    without the attributes used to count as linked)."""
    for _, frame in doc.text_frames():
        if frame.previous_frame not in (None, 'n') or frame.next_frame not in (None, 'n'):
            report(results, 'LINKED_TEXT_FRAME', **at_frame(doc, frame))


def object_style_check(doc: Document, results: Results) -> None:
    """Error for each text frame, and each placed image or its frame, using an object style other
    than InDesign's defaults."""
    for _, frame in doc.text_frames():
        if frame.object_style not in doc.default_object_styles:
            report(results, 'OBJECT_STYLE', **at_frame(doc, frame))

    for spread, link in doc.links():
        # The image and its frame each count: one error for each that has a custom object style.
        for style in (link.graphic_object_style, link.frame_object_style):
            if style not in doc.default_object_styles:
                report(results, 'OBJECT_STYLE', **at_link(doc, spread, link))
