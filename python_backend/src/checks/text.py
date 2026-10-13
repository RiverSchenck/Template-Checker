"""Checks on text: paragraph and character styles, overrides, kerning, composer, tables, superscript."""
from itertools import groupby
from typing import Dict, List

from src.checks._report import at_story, at_style, inherited, report, text_list
from src.model import subject as subjects
from src.model.document import NO_CHARACTER_STYLE, Document, short_style_id
from src.results.results import Results


def format_overrides(overrides: Dict[str, str]) -> str:
    """Format overrides dict for display, e.g. 'LeftIndent: 18, FirstLineIndent: -18'."""
    if not overrides:
        return ""
    return ", ".join(f"{k}: {v}" for k, v in overrides.items())


def run_overrides(run) -> Dict[str, str]:
    """Formatting set on a run's text: its Properties, then its attributes (which win)."""
    return {**run.properties, **run.attrs}


def generate_context_message(content: str, neighbours: List[str], index: int):
    """For text that's only whitespace, say where it is: next to which neighbouring text (neighbours: the text
    of each item in the list content is item index of)."""
    if not content.strip():
        prev_content = neighbours[index - 1].strip() if index > 0 else ''
        next_content = neighbours[index + 1].strip() if index < len(neighbours) - 1 else ''
        if prev_content:
            return f'Whitespace after text: {prev_content}'
        elif next_content:
            return f'Whitespace before text: {next_content}'
        else:
            return 'Whitespace'
    return ''


def _grouped(paragraphs):
    """Consecutive paragraphs with the same paragraph style."""
    return [list(group) for _, group in groupby(paragraphs, key=lambda paragraph: paragraph.style)]


def par_style_check(doc: Document, results: Results) -> None:
    """Text without a paragraph style. Error when a whole text frame uses only a default style ([No
    paragraph style] / [Basic Paragraph]); otherwise an error per run of default-styled text
    (consecutive ranges with the same style are grouped). Info for empty text frames."""
    # Master-page text frames are stories too, so they're checked as well.
    for story in doc.stories or ():
        story_content = ''.join(run.text for _, run in doc.runs(story))
        if not story_content or story_content == ' ':
            report(results, 'EMPTY_TEXT_FRAME', **at_story(doc, story))
            continue

        grouped = _grouped(doc.paragraphs(story))
        if len(grouped) == 1 and grouped[0][0].style in doc.default_par_styles:
            report(results, 'PARAGRAPH_STYLE', **at_story(doc, story),
                   context_details={'whole_frame': True, 'whitespace_only': not story_content.strip()})
            continue

        texts = [''.join(paragraph.text for paragraph in group) for group in grouped]
        for i, group in enumerate(grouped):
            if group[0].style in doc.default_par_styles:
                content = texts[i]
                # Whitespace-only text needs its neighbours to be findable. One line: line breaks show as spaces.
                message = f"{content.replace(chr(10), ' ')} {generate_context_message(content, texts, i)}"
                report(results, 'PARAGRAPH_STYLE', message, text_content=text_list(content), **at_story(doc, story),
                       context_details={'whole_frame': False, 'whitespace_only': not content.strip()})


def hyphenation_check(doc: Document, results: Results) -> None:
    """Warning for each paragraph whose style (through BasedOn) has hyphenation on. Default styles
    are skipped."""
    for story in doc.stories or ():
        for paragraph in doc.paragraphs(story):
            hyphenation = doc.styles.resolve(paragraph.style, 'Hyphenation')
            if hyphenation.value == 'true' and paragraph.style not in doc.default_par_styles:
                context, details = inherited(hyphenation, paragraph.style)
                report(results, 'HYPHENATION', context, text_content=text_list(paragraph.text),
                       context_details=details, **at_style(doc, story, 'paragraph_style', paragraph.style))


def _report_override(doc: Document, results: Results, story, content: str, overrides: Dict[str, str],
                     neighbours: List[str], index: int) -> None:
    """One override warning for a character or paragraph range, grouped under its text frame (the results
    show that frame's full text)."""
    frame_id = doc.story_frame.get(story.id, '')
    # The message is one line: a line break in the text shows as a space (facts keep the real text).
    text_part = f"Text: {content.replace(chr(10), ' ')} {generate_context_message(content, neighbours, index)}".strip()
    overrides_str = format_overrides(overrides)
    message = f"{text_part} — Overrides: {overrides_str}" if overrides_str else text_part
    report(results, 'OVERRIDE', message,
           page_id=doc.story_page.get(story.id),
           data_id=frame_id,
           text_content=text_list(content),
           context_details={"text": content or "", "overrides": overrides},
           subject=subjects.text_frame(story.id, frame_id))


def overrides_check(doc: Document, results: Results) -> None:
    """Warning for text formatted outside its style: character-level overrides, or paragraph-level
    ones when the paragraph has none at character level (to avoid reporting both)."""
    for story in doc.stories or ():
        paragraphs = doc.paragraphs(story)
        paragraph_texts = [paragraph.text for paragraph in paragraphs]
        for par_idx, paragraph in enumerate(paragraphs):
            run_texts = [run.text for run in paragraph.runs]
            overridden_runs = [(i, run) for i, run in enumerate(paragraph.runs) if run_overrides(run)]
            for char_idx, run in overridden_runs:
                _report_override(doc, results, story, run.text, run_overrides(run), run_texts, char_idx)
            if paragraph.attrs and not overridden_runs:
                _report_override(doc, results, story, paragraph.text, dict(paragraph.attrs), paragraph_texts, par_idx)


def kerning_check(doc: Document, results: Results) -> None:
    """Error when a paragraph style or character style (through BasedOn) uses kerning other than
    Metrics. Kerning set directly on text is an override, reported by overrides_check."""
    for story in doc.stories or ():
        for paragraph in doc.paragraphs(story):
            for check, kind, style, text in \
                    [('KERNING', 'paragraph_style', paragraph.style, paragraph.text)] + \
                    [('KERNING_CHAR', 'character_style', run.style, run.text) for run in paragraph.runs]:
                kerning = doc.styles.resolve(style, 'KerningMethod')
                if kerning.value and kerning.value != "Metrics":
                    context, details = inherited(kerning, style)
                    report(results, check, context, text_content=text_list(text),
                           context_details=details, **at_style(doc, story, kind, style))


def table_check(doc: Document, results: Results) -> None:
    """Error for each table in a story (reported against the story's text frame)."""
    for story in doc.stories or ():
        for _, run in doc.runs(story):
            if run.has_table:
                report(results, 'TABLE', **at_story(doc, story))


def _once_per_style(doc: Document, results: Results, check: str, prop: str, is_issue, context_of) -> None:
    """Report each paragraph style at most once, at the first story that uses it."""
    reported = set()
    for story in doc.stories or ():
        for paragraph in doc.paragraphs(story):
            style = short_style_id(paragraph.style)
            resolved = doc.styles.resolve(paragraph.style, prop)
            if style not in reported and is_issue(resolved.value):
                reported.add(style)
                _, details = inherited(resolved, paragraph.style)
                report(results, check, context_of(resolved, paragraph.style), context_details=details,
                       **at_style(doc, story, 'paragraph_style', paragraph.style))


def grid_alignment_check(doc: Document, results: Results) -> None:
    """Error, once per paragraph style, when its style (through BasedOn) aligns to the baseline
    grid."""
    _once_per_style(doc, results, 'GRID_ALIGNMENT', 'GridAlignment',
                    is_issue=lambda value: value not in (None, 'None'),
                    context_of=lambda resolved, style: inherited(resolved, style)[0])


# Single-line composers Frontify keeps when it writes edited text back (Idml.php getTextComposer): Adobe
# Single-line, and World-Ready Single-line. Every other composer becomes one of these on export.
SINGLE_LINE_COMPOSERS = ('HL Single', 'HL Single Optyca')


def composer_check(doc: Document, results: Results) -> None:
    """Warning, once per paragraph style, when its style (through BasedOn) uses a composer other
    than a single-line one (Adobe or World-Ready Single-line)."""
    _once_per_style(doc, results, 'COMPOSER', 'Composer',
                    is_issue=lambda value: value not in SINGLE_LINE_COMPOSERS,
                    context_of=lambda resolved, style: inherited(resolved, style)[0])


DEFAULT_TINTS = (None, '', '-1', '100')


def _tint_context(resolved, style) -> str:
    message = f'Fill Tint is: {resolved.value}'
    source = resolved.inherited_from(style)
    return f'{message}; Inherited from: {source}' if source else message


def other_checks(doc: Document, results: Results) -> None:
    """Fill tint: error, once per paragraph style and once per character style, when the style's fill
    tint (through BasedOn) is set to anything but 100% (-1 and unset mean the default, 100%). Frontify
    shows text colours untinted; a tint swatch works."""
    _once_per_style(doc, results, 'FILL_TINT', 'FillTint',
                    is_issue=lambda value: value not in DEFAULT_TINTS, context_of=_tint_context)

    reported = set()
    for story in doc.stories or ():
        for _, run in doc.runs(story):
            style = run.style
            if not style or style == NO_CHARACTER_STYLE or style in reported:
                continue
            tint = doc.styles.resolve(style, 'FillTint')
            if tint.value in DEFAULT_TINTS:
                continue
            reported.add(style)
            _, details = inherited(tint, style)
            report(results, 'FILL_TINT_CHAR', _tint_context(tint, style),
                   context_details=details, **at_style(doc, story, 'character_style', style))


def _position_context(name: str, value: str, source: str) -> str:
    message = f'{name} is: {value}'
    return f'{message}; Inherited from: {source}' if source else message


def position_check(doc: Document, results: Results) -> None:
    """Superscript, subscript and baseline shift, per text run, wherever the value comes from (the text,
    its character style, the paragraph or its style). Frontify reads neither: superscripts show full size
    on the baseline (error), shifted text sits on the baseline (warning)."""
    for story in doc.stories or ():
        for paragraph, run in doc.runs(story):
            content = run.text
            if not content.strip():
                continue
            where = at_style(doc, story, 'character_style', run.style)
            position, source = doc.effective(paragraph, run, "Position")
            if position and position != 'Normal':
                report(results, 'TEXT_POSITION', _position_context('Position', position, source),
                       text_content=text_list(content),
                       context_details={'inherited_from': source} if source else None, **where)
            shift, source = doc.effective(paragraph, run, "BaselineShift")
            if shift and _non_zero(shift):
                report(results, 'BASELINE_SHIFT',
                       _position_context('Baseline Shift', f'{shift}pt', source), text_content=text_list(content),
                       context_details={'inherited_from': source} if source else None, **where)


def _non_zero(value: str) -> bool:
    try:
        return abs(float(value)) > 1e-6
    except ValueError:
        return False
