"""Checks on page layout: master pages, page items, bleed, text frames, object styles."""

from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform, TransformKind


def masterpage_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Checks masterspreads_parser for unexprected elements (not properties or page)"""
    # doc.masterspreads_parser.print_unexpected_elements()  # Debug Print
    unexpected_elements = doc.masterspreads_parser.get_unexpected_elements()
    message = ''
    if unexpected_elements:
        message = 'Elements: ' + ', '.join(unexpected_elements)

        results.add_error(
            context=message,
            error_type=ValidationError.MASTERPAGE,
            page_id='',
            identifier=None,
            data_id='null'
        )


def page_item_transformation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Checks TextFrame, Rectangle (without Link), Oval, Polygon, and Group for ItemTransform
    flip/skew (error) and rotation (warning), separate from image link logic."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        pages = spread.get_pages()
        spread_page_id = pages[0].get("self", '') if pages and len(pages) > 0 else ''
        for cand in spread.get_page_item_transform_candidates():
            tag = cand.get('tag') or 'Item'
            self_id = cand.get('self_id') or ''
            raw = cand.get('item_transform') or ''
            parsed = parse_item_transform(raw)
            if parsed is None:
                continue
            a, b, c, d, _e, _f = parsed
            page_id = doc.find_page_id_from_data_id(self_id) if self_id else spread_page_id
            classification = classify_page_item_transform(a, b, c, d)
            if classification.kind == TransformKind.NONE:
                continue
            identifier = f"{tag}:{self_id}" if self_id else tag
            message = f"{tag} {classification.message}"
            if classification.is_error:
                results.add_error(
                    context=message,
                    error_type=ValidationError.PAGE_ITEM_TRANSFORMATION,
                    page_id=page_id,
                    identifier=identifier,
                    data_id=self_id or 'null',
                )
            elif classification.kind == TransformKind.ROTATION:
                results.add_warning(
                    context=message,
                    warning_type=ValidationWarning.PAGE_ITEM_TRANSFORMATION,
                    page_id=page_id,
                    identifier=identifier,
                    data_id=self_id or 'null',
                )


def pasted_graphics_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Checks for pasted graphics, by iterating through each spread. We can then check the
    num_pasted_graphics from spreads_parser."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        num_pasted_graphics = spread.get_pasted_graphics_num()
        if num_pasted_graphics > 0:
            # Get first page's Self from spread
            pages = spread.get_pages()
            page_id = pages[0].get("self", '') if pages and len(pages) > 0 else ''
            for _ in range(num_pasted_graphics):
                message = f"{spread.get_pasted_graphics_num()} pasted graphics found."
                results.add_error(
                    context=message,
                    error_type=ValidationError.PASTED_GRAPHICS,
                    page_id=page_id,
                    identifier=None
                )
                break


def document_bleed_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """If document bleed is not '0' then error."""
    bleed_values = doc.preferences_parser.get_document_bleed()
    print(bleed_values)
    if bleed_values is not None:
        for _, value in bleed_values.items():
            if value != '0':
                bleed_descriptions = ', '.join(
                    f"{k}: {v}pt" for k, v in bleed_values.items())
                message = f"{bleed_descriptions}."
                results.add_warning(
                    context=message,
                    warning_type=ValidationWarning.DOCUMENT_BLEED,
                    page_id='',
                    identifier=None,
                    data_id='null'
                )
                # Only need one warning
                break


def auto_size_text_box_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """This check verifies that text frames within the document are not set to auto-size from an
    unsupported reference point. The function iterates through each text frame in each spread of the
    document. It checks the auto-sizing type of the text frame and ensures that: - If auto-sizing is
    set to 'HeightOnly', the reference point is not centered. - If auto-sizing is set to
    'WidthOnly', the 'No Line Breaks' option must be enabled, and the reference point cannot be
    centered. - If auto-sizing is set to 'HeightAndWidth', the 'No Line Breaks' option must be
    enabled, and the sizing must be referenced from one of the corners."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_is_auto_size():
                # Verify not auto sizing from center
                story_id, story_page_id = doc.frame_story_and_page(text_frame)
                data_id = text_frame.get_frame_id()
                use_line_breaks = text_frame.get_use_no_line_breaks()
                if text_frame.get_auto_sizing_type() == 'HeightOnly':
                    if text_frame.get_auto_sizing_reference_point() not in ['TopCenterPoint', 'BottomCenterPoint']:
                        message = "HeightOnly cannot autosize from center."
                        results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page_id=story_page_id,
                            identifier=story_id,
                            data_id=data_id
                        )
                elif text_frame.get_auto_sizing_type() == 'WidthOnly':
                    if not use_line_breaks or use_line_breaks == 'false':
                        message = "'No Line Breaks' must be checked."
                        results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page_id=story_page_id,
                            identifier=story_id,
                            data_id=data_id)
                        # InDesign has weird behavior, and changes the reference point if 'No Line Breaks' is not checked. So we will just break here.
                        continue
                    if text_frame.get_auto_sizing_reference_point() not in ['LeftCenterPoint', 'RightCenterPoint']:
                        message = "WidthOnly cannot autosize from center."
                        results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page_id=story_page_id,
                            identifier=story_id,
                            data_id=data_id
                        )
                elif text_frame.get_auto_sizing_type() == 'HeightAndWidth':
                    if not use_line_breaks or use_line_breaks == 'false':
                        message = "'No Line Breaks' must be checked."
                        results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page_id=story_page_id,
                            identifier=story_id,
                            data_id=data_id
                        )
                        # InDesign has weird behavior, and changes the reference point if 'No Line Breaks' is not checked. So we will just break here.
                        continue
                    if text_frame.get_auto_sizing_reference_point() not in ['TopLeftPoint', 'BottomLeftPoint', 'BottomRightPoint', 'TopRightPoint']:
                        message = "HeightAndWidth must auto size from corners."
                        results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page_id=story_page_id,
                            identifier=story_id,
                            data_id=data_id)
                else:
                    message = "Only width, height, and WidthAndHeight are supported."
                    results.add_error(
                        context=message,
                        error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                        page_id=story_page_id,
                        identifier=story_id,
                        data_id=data_id
                    )


def text_columns_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Iterate through each spread, then each text frame. If the text_frames column count is larger
    than '1' (string) then error."""
    # Just checking columns, not fixed width column settings
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_text_column_count() and text_frame.get_text_column_count() != '1':
                story_id, story_page_id = doc.frame_story_and_page(text_frame)
                data_id = text_frame.get_frame_id()
                results.add_error(
                    context=None,
                    error_type=ValidationError.TEXT_COLUMNS,
                    page_id=story_page_id,
                    identifier=story_id,
                    data_id=data_id
                )


def text_wrap_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Iterate through each spread, then each text frame. If the text_frames wrap mode is not 'None'
    error"""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            text_wrap_mode = text_frame.get_text_wrap_mode()
            # No TextWrapPreference means InDesign's default: no wrap.
            if text_wrap_mode not in (None, 'None'):
                story_id, story_page_id = doc.frame_story_and_page(text_frame)
                data_id = text_frame.get_frame_id()
                message = f"Text box wrap is '{text_wrap_mode}' not None."
                results.add_error(
                    context=message,
                    error_type=ValidationError.TEXT_WRAP,
                    page_id=story_page_id,
                    identifier=story_id,
                    data_id=data_id
                )


def linked_text_frame_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Iterate through each spread, then each text frame. Check get_is_linked_text_frame(). If true
    then error."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_is_linked_text_frame():
                story_id, story_page_id = doc.frame_story_and_page(text_frame)
                data_id = text_frame.get_frame_id()
                results.add_error(
                    context=None,
                    error_type=ValidationError.LINKED_TEXT_FRAME,
                    page_id=story_page_id,
                    identifier=story_id,
                    data_id=data_id
                )


def object_style_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Iterate through each spread, then each text frame. Check if the object style is a default
    object style found in default_object_styles. Do the same for all link objects."""
    # ONLY CHECKS TEXT FRAMES AND IMAGES

    # Check Text Frames
    for spread in doc.spreads_parser.get_spreads_obj_list():
        for text_frame in spread.get_text_frame_obj_list():
            if text_frame.get_applied_object_style() not in doc.default_object_styles:
                _, story_page_id = doc.frame_story_and_page(text_frame)
                data_id = text_frame.get_frame_id()
                results.add_error(
                    context=None,
                    error_type=ValidationError.OBJECT_STYLE_TEXT,
                    page_id=story_page_id,
                    identifier=None,
                    data_id=data_id
                )

    for spread in doc.spreads_parser.get_spreads_obj_list():
        # Get first page's Self from spread
        pages = spread.get_pages()
        spread_page_id = pages[0].get("self", '') if pages and len(pages) > 0 else ''
        for link in spread.get_links_obj_list():
            rectangle_id = link.get_rectangle_link_id()
            # Try to find the specific page_id from data_id, fallback to spread's first page
            page_id = doc.find_page_id_from_data_id(rectangle_id) if rectangle_id else spread_page_id
            if link.get_image_object_style() not in doc.default_object_styles:
                image_name = link.get_image_name()
                results.add_error(
                    context=None,
                    error_type=ValidationError.OBJECT_STYLE_IMAGE,
                    page_id=page_id,
                    identifier=image_name,
                    data_id=rectangle_id
                )
            if link.get_container_object_style() not in doc.default_object_styles:
                image_name = link.get_image_name()
                results.add_error(
                    context=None,
                    error_type=ValidationError.OBJECT_STYLE_IMAGE,
                    page_id=page_id,
                    identifier=image_name,
                    data_id=rectangle_id
                )
