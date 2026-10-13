"""Checks on text: paragraph and character styles, overrides, kerning, composer, tables, superscript."""
from typing import Dict, List, Union

from src.checks._report import at_story, inherited, report, text_list
from src.classes.PropertyBase import PropertyBase
from src.classes.StoryCharacterData import NO_CHARACTER_STYLE
from src.document import ParsedDocument
from src.results.results import Results
from src.results.classifiers import ValidationError, ValidationInfo, ValidationWarning


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


def par_style_check(doc: ParsedDocument, results: Results) -> None:
    """Text without a paragraph style. Error when a whole text frame uses only a default style ([No
    paragraph style] / [Basic Paragraph]); otherwise an error per run of default-styled text
    (consecutive ranges with the same style are grouped). Info for empty text frames."""
    # Master-page text frames are stories too, so they're checked as well.
    for story in doc.stories_parser.stories_data_list:
        story_id = story.story_id
        story_content = story.get_story_text_content()
        if not story_content or story_content == ' ':
            report(results, ValidationInfo.EMPTY_TEXT_FRAME, **at_story(story, story_id))
            continue

        grouped = story.grouped_paragraph_styles
        if len(grouped) == 1 and grouped[0][0].style_id in doc.default_par_styles:
            report(results, ValidationError.PARAGRAPH_STYLE_TEXT_BOX, **at_story(story, story_id))
            continue

        for i, group in enumerate(grouped):
            if group[0].style_id in doc.default_par_styles:
                content = ''.join(par_style.get_content() for par_style in group)
                # Whitespace-only text needs its neighbours to be findable.
                message = f"{content} {generate_context_message(content, grouped, i)}"
                report(results, ValidationError.PARAGRAPH_STYLE, message,
                       text_content=text_list(content), **at_story(story, group[0].normalized_style_id))


def hyphenation_check(doc: ParsedDocument, results: Results) -> None:
    """Warning for each paragraph whose style (through BasedOn) has hyphenation on. Default styles
    are skipped."""
    for story in doc.stories_parser.stories_data_list:
        for par_style in story.paragraph_styles:
            if par_style.has_hyphenation() and par_style.style_id not in doc.default_par_styles:
                context, details = inherited(par_style.hyphenation_obj)
                report(results, ValidationWarning.HYPHENATION, context, text_content=text_list(par_style.get_content()),
                       context_details=details, **at_story(story, par_style.normalized_style_id))


def _report_override(results: Results, story, item, siblings, index) -> None:
    """One override warning for a character or paragraph range, grouped under its text frame (the results
    show that frame's full text)."""
    frame_id = story.parent_text_frame_id
    content = item.get_content()
    text_part = f"Text: {content} {generate_context_message(content, siblings, index)}".strip()
    overrides_str = format_overrides(item.overrides)
    message = f"{text_part} — Overrides: {overrides_str}" if overrides_str else text_part
    report(results, ValidationWarning.OVERRIDE, message,
           page_id=story.page_id,
           identifier=frame_id if frame_id and frame_id != 'null' else 'null',
           data_id=frame_id,
           text_content=text_list(content),
           context_details={"text": content or "", "overrides": item.overrides})


def overrides_check(doc: ParsedDocument, results: Results) -> None:
    """Warning for text formatted outside its style: character-level overrides, or paragraph-level
    ones when the paragraph has none at character level (to avoid reporting both)."""
    for story in doc.stories_parser.stories_data_list:
        paragraphs = story.paragraph_styles
        for par_idx, par_style in enumerate(paragraphs):
            runs = par_style.child_char_style_objs
            overridden_runs = [(i, run) for i, run in enumerate(runs) if run.has_overrides()]
            for char_idx, run in overridden_runs:
                _report_override(results, story, run, runs, char_idx)
            if par_style.has_overrides() and not overridden_runs:
                _report_override(results, story, par_style, paragraphs, par_idx)


def kerning_check(doc: ParsedDocument, results: Results) -> None:
    """Error when a paragraph style or character style (through BasedOn) uses kerning other than
    Metrics. Kerning set directly on text is an override, reported by overrides_check."""
    for story in doc.stories_parser.stories_data_list:
        for par_style in story.paragraph_styles:
            for classifier, item in [(ValidationError.KERNING, par_style)] + \
                                    [(ValidationError.KERNING_CHAR, run) for run in par_style.child_char_style_objs]:
                kerning = item.kerning_obj
                value = kerning.value
                if value and value != "Metrics":
                    context, details = inherited(kerning)
                    report(results, classifier, context, text_content=text_list(item.get_content()),
                           context_details=details, **at_story(story, item.normalized_style_id))


def table_check(doc: ParsedDocument, results: Results) -> None:
    """Error for each table in a story (reported against the story's text frame)."""
    for story in doc.stories_parser.stories_data_list:
        for run in story.character_styles:
            if run.has_table():
                report(results, ValidationError.TABLE, **at_story(story, story.story_id))


def _once_per_style(doc: ParsedDocument, results: Results, classifier, is_issue, prop_of, context_of) -> None:
    """Report each paragraph style at most once, at the first story that uses it."""
    reported = set()
    for story in doc.stories_parser.stories_data_list:
        for par_style in story.paragraph_styles:
            style = par_style.normalized_style_id
            if style not in reported and is_issue(par_style):
                reported.add(style)
                prop = prop_of(par_style)
                _, details = inherited(prop)
                report(results, classifier, context_of(par_style, prop), context_details=details,
                       **at_story(story, style))


def grid_alignment_check(doc: ParsedDocument, results: Results) -> None:
    """Error, once per paragraph style, when its style (through BasedOn) aligns to the baseline
    grid."""
    _once_per_style(doc, results, ValidationError.GRID_ALIGNMENT,
                    is_issue=lambda p: p.get_grid_alignment() not in (None, 'None'),
                    prop_of=lambda p: p.grid_alignment_obj,
                    context_of=lambda p, prop: inherited(prop)[0])


# Single-line composers Frontify keeps when it writes edited text back (Idml.php getTextComposer): Adobe
# Single-line, and World-Ready Single-line. Every other composer becomes one of these on export.
SINGLE_LINE_COMPOSERS = ('HL Single', 'HL Single Optyca')


def composer_check(doc: ParsedDocument, results: Results) -> None:
    """Warning, once per paragraph style, when its style (through BasedOn) uses a composer other
    than a single-line one (Adobe or World-Ready Single-line)."""
    _once_per_style(doc, results, ValidationWarning.COMPOSER,
                    is_issue=lambda p: p.get_composer() not in SINGLE_LINE_COMPOSERS,
                    prop_of=lambda p: p.composer_obj,
                    context_of=lambda p, prop: inherited(prop)[0])


DEFAULT_TINTS = (None, '', '-1', '100')


def other_checks(doc: ParsedDocument, results: Results) -> None:
    """Fill tint: error, once per paragraph style and once per character style, when the style's fill
    tint (through BasedOn) is set to anything but 100% (-1 and unset mean the default, 100%). Frontify
    shows text colours untinted; a tint swatch works."""
    def context_of(par_style, prop):
        source = prop.inherited_from
        message = f'Fill Tint is: {par_style.get_filltint()}'
        return f'{message}; Inherited from: {source}' if source else message

    _once_per_style(doc, results, ValidationError.FILL_TINT,
                    is_issue=lambda p: p.get_filltint() not in DEFAULT_TINTS,
                    prop_of=lambda p: p.filltint_obj,
                    context_of=context_of)

    reported = set()
    for story in doc.stories_parser.stories_data_list:
        for run in story.character_styles:
            style = run.style_id
            if not style or style == NO_CHARACTER_STYLE or style in reported:
                continue
            prop = PropertyBase(style, run.styles_parser, "FillTint")
            if prop.value in DEFAULT_TINTS:
                continue
            reported.add(style)
            message = f'Fill Tint is: {prop.value}'
            _, details = inherited(prop)
            report(results, ValidationError.FILL_TINT_CHAR,
                   f'{message}; Inherited from: {prop.inherited_from}' if prop.inherited_from else message,
                   context_details=details, **at_story(story, run.normalized_style_id))


def _position_context(name: str, value: str, source: str) -> str:
    message = f'{name} is: {value}'
    return f'{message}; Inherited from: {source}' if source else message


def position_check(doc: ParsedDocument, results: Results) -> None:
    """Superscript, subscript and baseline shift, per text run, wherever the value comes from (the text,
    its character style, the paragraph or its style). Frontify reads neither: superscripts show full size
    on the baseline (error), shifted text sits on the baseline (warning)."""
    for story in doc.stories_parser.stories_data_list:
        for run in story.character_styles:
            content = run.get_content()
            if not content.strip():
                continue
            where = at_story(story, run.normalized_style_id)
            position, source = run.effective("Position")
            if position and position != 'Normal':
                report(results, ValidationError.TEXT_POSITION, _position_context('Position', position, source),
                       text_content=text_list(content),
                       context_details={'inheritedFrom': source} if source else None, **where)
            shift, source = run.effective("BaselineShift")
            if shift and _non_zero(shift):
                report(results, ValidationWarning.BASELINE_SHIFT,
                       _position_context('Baseline Shift', f'{shift}pt', source), text_content=text_list(content),
                       context_details={'inheritedFrom': source} if source else None, **where)


def _non_zero(value: str) -> bool:
    try:
        return abs(float(value)) > 1e-6
    except ValueError:
        return False
