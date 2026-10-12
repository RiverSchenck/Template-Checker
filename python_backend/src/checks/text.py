"""Checks on text: paragraph and character styles, overrides, kerning, composer, tables."""
from typing import Dict, List, Union

from src.checks._report import at_story, inherited, report, text_list
from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationInfo, ValidationWarning


def format_overrides(overrides: Dict[str, str]) -> str:
    """Format overrides dict for display, e.g. 'LeftIndent: 18, FirstLineIndent: -18'."""
    if not overrides:
        return ""
    return ", ".join(f"{k}: {v}" for k, v in overrides.items())


def generate_context_message(content: str, items: Union[List[List['StoryParagraphData']], List[List['StoryCharacterData']]], index: int):
    """For text that's only whitespace, say where it is: next to which neighbouring text."""
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
    # Master-page text frames are stories too, so they're checked as well.
    for story in doc.stories_parser.get_stories_data():
        story_id = story.get_story_id()
        story_content = story.get_story_text_content()
        if not story_content or story_content == ' ':
            report(results, ValidationInfo.EMPTY_TEXT_FRAME, **at_story(story, story_id))
            continue

        grouped = story.get_grouped_paragraph_styles()
        if len(grouped) == 1 and grouped[0][0].get_style_id() in doc.default_par_styles:
            report(results, ValidationError.PARAGRAPH_STYLE_TEXT_BOX, **at_story(story, story_id))
            continue

        for i, group in enumerate(grouped):
            if group[0].get_style_id() in doc.default_par_styles:
                content = ''.join(par_style.get_content() for par_style in group)
                # Whitespace-only text needs its neighbours to be findable.
                message = f"{content} {generate_context_message(content, grouped, i)}"
                report(results, ValidationError.PARAGRAPH_STYLE, message,
                       text_content=text_list(content), **at_story(story, group[0].get_normalized_style_id()))


def hyphenation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning for each paragraph whose style (through BasedOn) has hyphenation on. Default styles
    are skipped."""
    for story in doc.stories_parser.get_stories_data():
        for par_style in story.get_paragraph_styles():
            if par_style.has_hyphenation() and par_style.get_style_id() not in doc.default_par_styles:
                context, details = inherited(par_style.get_hyphenation_obj())
                report(results, ValidationWarning.HYPHENATION, context, text_content=text_list(par_style.get_content()),
                       context_details=details, **at_story(story, par_style.get_normalized_style_id()))


def _remember_frame_text(results: ValidationResult, story, frame_id) -> None:
    """Override issues are grouped by text frame; the frontend shows that frame's full text from text_box_data."""
    if frame_id and frame_id != 'null' and frame_id not in results.text_box_data:
        page_id = story.get_page_id()
        results.text_box_data[frame_id] = {
            "identifier": frame_id,
            "content": story.get_content(),
            "page_id": page_id if page_id is not None else "",
            "frame_id": frame_id,
        }


def _report_override(results: ValidationResult, story, item, siblings, index) -> None:
    """One override warning for a character or paragraph range, grouped under its text frame."""
    frame_id = story.get_parent_text_frame_id()
    content = item.get_content()
    text_part = f"Text: {content} {generate_context_message(content, siblings, index)}".strip()
    overrides_str = format_overrides(item.get_overrides())
    message = f"{text_part} — Overrides: {overrides_str}" if overrides_str else text_part
    _remember_frame_text(results, story, frame_id)
    report(results, ValidationWarning.OVERRIDE, message,
           page_id=story.get_page(),
           identifier=frame_id if frame_id and frame_id != 'null' else 'null',
           data_id=frame_id,
           text_content=text_list(content),
           context_details={"text": content or "", "overrides": item.get_overrides()})


def overrides_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning for text formatted outside its style: character-level overrides, or paragraph-level
    ones when the paragraph has none at character level (to avoid reporting both)."""
    for story in doc.stories_parser.get_stories_data():
        paragraphs = story.get_paragraph_styles()
        for par_idx, par_style in enumerate(paragraphs):
            runs = par_style.get_child_char_styles()
            overridden_runs = [(i, run) for i, run in enumerate(runs) if run.has_overrides()]
            for char_idx, run in overridden_runs:
                _report_override(results, story, run, runs, char_idx)
            if par_style.has_overrides() and not overridden_runs:
                _report_override(results, story, par_style, paragraphs, par_idx)


def kerning_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error when a paragraph style or character style (through BasedOn) uses kerning other than
    Metrics. Kerning set directly on text is an override, reported by overrides_check."""
    for story in doc.stories_parser.get_stories_data():
        for par_style in story.get_paragraph_styles():
            for classifier, item in [(ValidationError.KERNING, par_style)] + \
                                    [(ValidationError.KERNING_CHAR, run) for run in par_style.get_child_char_styles()]:
                kerning = item.get_kerning()
                value = kerning.get_property_value()
                if value and value != "Metrics":
                    context, details = inherited(kerning)
                    report(results, classifier, context, text_content=text_list(item.get_content()),
                           context_details=details, **at_story(story, item.get_normalized_style_id()))


def table_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each table in a story (reported against the story's text frame)."""
    for story in doc.stories_parser.get_stories_data():
        for run in story.get_character_styles():
            if run.has_table():
                report(results, ValidationError.TABLE, **at_story(story, story.get_story_id()))


def _once_per_style(doc: ParsedDocument, results: ValidationResult, classifier, is_issue, prop_of, context_of) -> None:
    """Report each paragraph style at most once, at the first story that uses it."""
    reported = set()
    for story in doc.stories_parser.get_stories_data():
        for par_style in story.get_paragraph_styles():
            style = par_style.get_normalized_style_id()
            if style not in reported and is_issue(par_style):
                reported.add(style)
                prop = prop_of(par_style)
                _, details = inherited(prop)
                report(results, classifier, context_of(par_style, prop), context_details=details,
                       **at_story(story, style))


def grid_alignment_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error, once per paragraph style, when its style (through BasedOn) aligns to the baseline
    grid."""
    _once_per_style(doc, results, ValidationError.GRID_ALIGNMENT,
                    is_issue=lambda p: p.get_grid_alignment() not in (None, 'None'),
                    prop_of=lambda p: p.get_grid_alignment_obj(),
                    context_of=lambda p, prop: inherited(prop)[0])


def composer_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Warning, once per paragraph style, when its style (through BasedOn) uses a composer other
    than Adobe Single-line (HL Single)."""
    _once_per_style(doc, results, ValidationWarning.COMPOSER,
                    is_issue=lambda p: p.get_composer() != 'HL Single',
                    prop_of=lambda p: p.get_composer_obj(),
                    context_of=lambda p, prop: inherited(prop)[0])


def other_checks(doc: ParsedDocument, results: ValidationResult) -> None:
    """Fill tint: error, once per paragraph style, when its style's fill tint is set to anything but
    100% (-1 and unset mean the default, 100%)."""
    def context_of(par_style, prop):
        source = prop.get_inherited_from_value()
        message = f'Fill Tint is: {par_style.get_filltint()}'
        return f'{message}; Inherited from: {source}' if source else message

    _once_per_style(doc, results, ValidationError.FILL_TINT,
                    is_issue=lambda p: p.get_filltint() not in [None, '-1', '100'],
                    prop_of=lambda p: p.get_filltint_obj(),
                    context_of=context_of)
