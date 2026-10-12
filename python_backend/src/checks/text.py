"""Checks on text: paragraph and character styles, overrides, kerning, composer, tables."""
from typing import Dict, List, Union

from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo


def format_overrides(overrides: Dict[str, str]) -> str:
    """Format overrides dict for display, e.g. 'LeftIndent: 18, FirstLineIndent: -18'."""
    if not overrides:
        return ""
    return ", ".join(f"{k}: {v}" for k, v in overrides.items())


def generate_context_message(content: str, items: Union[List[List['StoryParagraphData']], List[List['StoryCharacterData']]], index: int):
    def get_content_from_item(item):
        # Extract content from a single item or a group of items
        if isinstance(item, list):
            return ''.join(par_style.get_content() for par_style in item)
        return item.get_content()

    if not content.strip():
        prev_content = get_content_from_item(
            items[index - 1]) if index > 0 else ''
        next_content = get_content_from_item(
            items[index + 1]) if index < len(items) - 1 else ''

        prev_content = prev_content.strip()
        next_content = next_content.strip()

        if prev_content:
            return f'Whitespace after text: {prev_content}'
        elif next_content:
            return f'Whitespace before text: {next_content}'
        else:
            return 'Whitespace'
    return ''


def par_style_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Text without a paragraph style. Error when a whole text frame uses only a default style ([No
    paragraph style] / [Basic Paragraph]); otherwise an error per run of default-styled text
    (consecutive ranges with the same style are grouped). Info for empty text frames."""
    # doc.stories_parser.print_stories_data()  # Debug Print
    # Currently master page par styles are checked too, as text frames are a story. Might want to change in a phase 2.

    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        story_content = story.get_story_text_content()
        story_id = story.get_story_id()
        data_id = story.get_parent_text_frame_id()
        if not story_content or story_content == '' or story_content == ' ':
            results.add_info(
                context=None,
                info_type=ValidationInfo.EMPTY_TEXT_FRAME,
                page_id=page_id,
                identifier=story_id,
                data_id=data_id
            )
            continue
        grouped_paragraph_styles = story.get_grouped_paragraph_styles()

        if len(grouped_paragraph_styles) == 1 and grouped_paragraph_styles[0][0].get_style_id() in doc.default_par_styles:
            # Process single default paragraph style differently
            # Only one style in a text box
            content = grouped_paragraph_styles[0][0].get_content()
            context_message = generate_context_message(
                content, grouped_paragraph_styles, 0)
            results.add_error(
                context=None,
                error_type=ValidationError.PARAGRAPH_STYLE_TEXT_BOX,
                page_id=page_id,
                identifier=story_id,
                data_id=data_id
            )
            continue

        # Need index for content context
        for i, grouped_styles in enumerate(grouped_paragraph_styles):
            grouped_style_id = grouped_styles[0].get_style_id()
            normalized_style_id = grouped_styles[0].get_normalized_style_id()

            # Check if default paragraph styles were used
            if grouped_style_id in doc.default_par_styles:

                # Group the content of the grouped styles
                content = ''.join(par_style.get_content()
                                  for par_style in grouped_styles)
                # Check if content is empty or just space, we need more context as to where the issue is for end user
                context_message = generate_context_message(
                    content, grouped_paragraph_styles, i)
                message = f"{content} {context_message}"
                # Add text content so multiple occurrences are merged with text_content arrays combined
                text_content = [content] if content else None

                results.add_error(
                    context=message,
                    error_type=ValidationError.PARAGRAPH_STYLE,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    text_content=text_content
                )


def hyphenation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning for each paragraph whose style (through BasedOn) has hyphenation on. Default styles
    are skipped."""
    hyphenated_default_styles = set()

    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        data_id = story.get_parent_text_frame_id()
        for par_style in story.get_paragraph_styles():

            style_id = par_style.get_style_id()
            normalized_style_id = par_style.get_normalized_style_id()
            has_hyphenation = par_style.has_hyphenation()

            # Collect hyphenated default styles
            if (style_id in doc.default_par_styles) and has_hyphenation:
                hyphenated_default_styles.add(style_id)
                continue

            if has_hyphenation:
                # Format message with inheritance
                par_style_hyph_obj = par_style.get_hyphenation_obj()
                inherited_from = par_style_hyph_obj.get_inherited_from_value()
                inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''
                # Add text content so multiple occurrences are merged with text_content arrays combined
                text_content = [par_style.get_content()] if par_style.get_content() else None

                results.add_warning(
                    context=inherited_message,
                    warning_type=ValidationWarning.HYPHENATION,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    text_content=text_content,
                    context_details={"inheritedFrom": inherited_from} if inherited_from else None
                )

    # if hyphenated_default_styles:
    #     results.add_warning(
    #         context='',
    #         warning_type=ValidationWarning.HYPHENATION,
    #         page=None,
    #         identifier=normalized_style_id)


def overrides_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning for text formatted outside its style: character-level overrides, or paragraph-level
    ones when the paragraph has none at character level (to avoid reporting both)."""
    # Many overrides occur from the last or first char having an override, so showing the content isnt helpful.
    # Would be great to figure out a way to have better context in these situations
    overrides_default_par = False

    # Need index for content context
    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        story_id = story.get_story_id()
        # Normalize story_id to ensure it's not None (convert to 'null' if None)
        story_id = story_id if story_id is not None else 'null'
        paragraph_styles = story.get_paragraph_styles()
        data_id = story.get_parent_text_frame_id()
        for par_idx, par_style in enumerate(paragraph_styles):

            has_overrides = par_style.has_overrides()
            style_id = par_style.get_style_id()
            if (style_id in doc.default_par_styles) and has_overrides:
                overrides_default_par = True

            # Check character overrides first to see if there are individual occurrences
            char_styles = par_style.get_child_char_styles()
            has_char_overrides = False
            for char_idx, char_style in enumerate(char_styles):
                if char_style.has_overrides():
                    has_char_overrides = True
                    content = char_style.get_content()

                    context_message = generate_context_message(
                        content, char_styles, char_idx)
                    overrides_str = format_overrides(char_style.get_overrides())
                    text_part = f"Text: {content} {context_message}".strip()
                    message = f"{text_part} — Overrides: {overrides_str}" if overrides_str else text_part
                    text_content = [content] if content else None
                    # Use data_id (text frame ID) as identifier to group overrides by text frame
                    # Also ensure text_box_data is populated with data_id for frontend to find story content
                    if data_id and data_id != 'null' and data_id not in results.text_box_data:
                        # Extract story content keyed by data_id so frontend can find it
                        story_content = story.get_content()
                        story_page_id = story.get_page_id()
                        results.text_box_data[data_id] = {
                            "identifier": data_id,
                            "content": story_content,
                            "page_id": story_page_id if story_page_id is not None else "",
                            "frame_id": data_id,
                        }

                    results.add_warning(
                        context=message,
                        warning_type=ValidationWarning.OVERRIDE,
                        page_id=page_id,
                        identifier=data_id if data_id and data_id != 'null' else 'null',
                        data_id=data_id,
                        text_content=text_content,
                        context_details={"text": content or "", "overrides": char_style.get_overrides()}
                    )

            # Only report paragraph-level overrides if there are no character-level overrides
            # This prevents duplicate warnings (one for full item, then individual areas)
            if has_overrides and not has_char_overrides:
                content = par_style.get_content()
                context_message = generate_context_message(
                    content, paragraph_styles, par_idx)
                overrides_str = format_overrides(par_style.get_overrides())
                text_part = f"Text: {content} {context_message}".strip()
                message = f"{text_part} — Overrides: {overrides_str}" if overrides_str else text_part
                # Check if content is empty or just space, we need more context as to where the issue is for end user
                text_content = [content] if content else None
                # Use data_id (text frame ID) as identifier to group overrides by text frame
                # Also ensure text_box_data is populated with data_id for frontend to find story content
                if data_id and data_id != 'null' and data_id not in results.text_box_data:
                    # Extract story content keyed by data_id so frontend can find it
                    story_content = story.get_content()
                    story_page_id = story.get_page_id()
                    results.text_box_data[data_id] = {
                        "identifier": data_id,
                        "content": story_content,
                        "page_id": story_page_id if story_page_id is not None else "",
                        "frame_id": data_id,
                    }

                results.add_warning(
                    context=message,
                    warning_type=ValidationWarning.OVERRIDE,
                    page_id=page_id,
                    identifier=data_id if data_id and data_id != 'null' else 'null',
                    data_id=data_id,
                    text_content=text_content,
                    context_details={"text": content or "", "overrides": par_style.get_overrides()}
                )

    # if overrides_default_par:
    #     results.add_warning(
    #         "Many overrides due to no paragraph style applied to text.",
    #         ValidationWarning.OVERRIDE
    #     )


def kerning_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error when a paragraph style or character style (through BasedOn) uses kerning other than
    Metrics. Kerning set directly on text is an override, reported by overrides_check."""

    # Need index for content context
    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        paragraph_styles = story.get_paragraph_styles()
        data_id = story.get_parent_text_frame_id()
        for i, par_style in enumerate(paragraph_styles):

            par_kerning_obj = par_style.get_kerning()
            par_kerning_val = par_kerning_obj.get_property_value()
            if par_kerning_val and (par_kerning_val != "Metrics"):
                normalized_style_id = par_style.get_normalized_style_id()
                inherited_from = par_kerning_obj.get_inherited_from_value()
                inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''
                text_content = [par_style.get_content()] if par_style.get_content() else None

                results.add_error(
                    context=inherited_message,
                    error_type=ValidationError.KERNING,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    text_content=text_content,
                    context_details={"inheritedFrom": inherited_from} if inherited_from else None
                )

            # Now check character overrides
            char_styles = par_style.get_child_char_styles()

            for i, char_style in enumerate(char_styles):
                char_kerning_obj = char_style.get_kerning()
                char_kerning_val = char_kerning_obj.get_property_value()
                if char_kerning_val and (char_kerning_val != "Metrics"):
                    char_normalized_style_id = char_style.get_normalized_style_id()
                    inherited_from = char_kerning_obj.get_inherited_from_value()
                    inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''
                    text_content = [char_style.get_content()] if char_style.get_content() else None

                    results.add_error(
                        context=inherited_message,
                        error_type=ValidationError.KERNING_CHAR,
                        page_id=page_id,
                        identifier=char_normalized_style_id,
                        data_id=data_id,
                        text_content=text_content,
                        context_details={"inheritedFrom": inherited_from} if inherited_from else None
                    )


def table_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each table in a story (reported against the story's text frame)."""
    for story in doc.stories_parser.get_stories_data():
        for char_style in story.get_character_styles():
            if char_style.has_table():
                data_id = story.get_parent_text_frame_id()
                story_id = story.get_story_id()
                page_id = story.get_page()  # page Self
                results.add_error(
                    context=None,
                    error_type=ValidationError.TABLE,
                    page_id=page_id,
                    identifier=story_id,
                    data_id=data_id
                )


def grid_alignment_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error, once per paragraph style, when its style (through BasedOn) aligns to the baseline
    grid."""
    styles_with_errors = set()  # Only throw 1 error for a paragraph style
    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        for par_style in story.get_paragraph_styles():
            grid_alignment = par_style.get_grid_alignment()
            normalized_style_id = par_style.get_normalized_style_id()
            if grid_alignment not in (None, 'None') and normalized_style_id not in styles_with_errors:
                styles_with_errors.add(normalized_style_id)
                data_id = story.get_parent_text_frame_id()
                # Format message with inheritance
                par_style_grid_align_obj = par_style.get_grid_alignment_obj()
                inherited_from = par_style_grid_align_obj.get_inherited_from_value()
                inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                results.add_error(
                    context=inherited_message,
                    error_type=ValidationError.GRID_ALIGNMENT,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    context_details={"inheritedFrom": inherited_from} if inherited_from else None
                )


def composer_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning, once per paragraph style, when its style (through BasedOn) uses a composer other
    than Adobe Single-line (HL Single)."""
    styles_with_errors = set()  # Only throw 1 error for a paragraph style
    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        for par_style in story.get_paragraph_styles():
            composer = par_style.get_composer()
            normalized_style_id = par_style.get_normalized_style_id()
            if composer != 'HL Single' and normalized_style_id not in styles_with_errors:
                styles_with_errors.add(normalized_style_id)
                data_id = story.get_parent_text_frame_id()
                # Format message with inheritance
                par_style_composer_obj = par_style.get_composer_obj()
                inherited_from = par_style_composer_obj.get_inherited_from_value()
                inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                results.add_warning(
                    context=inherited_message,
                    warning_type=ValidationWarning.COMPOSER,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    context_details={"inheritedFrom": inherited_from} if inherited_from else None
                )


def other_checks(doc: ParsedDocument, results: ValidationResult) -> None:
    """Fill tint: error, once per paragraph style, when its style's fill tint is set to anything but
    100% (-1 and unset mean the default, 100%)."""
    styles_with_errors = set()  # Only throw 1 error for a paragraph style
    for story in doc.stories_parser.get_stories_data():
        page_id = story.get_page()  # page Self
        for par_style in story.get_paragraph_styles():
            filltint = par_style.get_filltint()
            normalized_style_id = par_style.get_normalized_style_id()
            if filltint not in [None, '-1', '100'] and normalized_style_id not in styles_with_errors:
                styles_with_errors.add(normalized_style_id)
                data_id = story.get_parent_text_frame_id()
                par_style_filltint_obj = par_style.get_filltint_obj()
                inherited_from = par_style_filltint_obj.get_inherited_from_value()
                context_message = f'Fill Tint is: {filltint}'
                if inherited_from:
                    context_message = f'{context_message}; Inherited from: {inherited_from}'

                results.add_error(
                    context=context_message,
                    error_type=ValidationError.FILL_TINT,
                    page_id=page_id,
                    identifier=normalized_style_id,
                    data_id=data_id,
                    context_details={"inheritedFrom": inherited_from} if inherited_from else None
                )
