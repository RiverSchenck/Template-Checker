"""The customer summary: a message support can paste into a reply, explaining what to change in the InDesign file.

This is the only place the summary is written. The web app shows the `customer_summary` that /run returns, and
POST /summary returns the same message for integrations such as Intercom.
"""
import math
import re
from dataclasses import dataclass, field
from typing import Optional

from src.results.notes import WIDTH_AUTO_SIZE, bleed_note, list_text, master_page_note, overrides_note, plural

from .report import Place, Problem, Subject, build_problems, format_pages, unique

MAX_LISTED = 3


def _shorten(text: str, max_length: int = 32) -> str:
    return f'{text[:max_length].rstrip()}…' if len(text) > max_length else text


def _pages_text(pages: list[str]) -> str:
    return f"{'page' if len(pages) == 1 else 'pages'} {format_pages(pages)}"


def _first_sentence(text: str) -> str:
    return re.split(r'(?<=[.!?])\s+', text)[0].strip()


# ------------------------------------------------------------------ Details from the checker, in customer words

def _place_detail(problem: Problem, place: Place) -> Optional[str]:
    """A short note about one place, e.g. "turn on No Line Breaks" or "15.25 MB", from the facts the check recorded.
    Raw checker values (skew factors, link ids) are left out."""
    facts = place.context_details or {}
    if problem.key == 'AUTO_SIZE_TEXT_BOX' and place.context:
        if facts.get('auto_size') in WIDTH_AUTO_SIZE:
            return 'turn on No Line Breaks'
        return place.context.removesuffix('.')
    if problem.key == 'LARGE_IMAGE' and facts.get('size_mb') is not None:
        return f"{facts['size_mb']} MB"
    return None


def _places_details(problem: Problem, places: list[Place]) -> list[str]:
    """Notes about one frame, style or image: its place details, or for overrides which formatting was changed."""
    if problem.key == 'OVERRIDE':
        changed = overrides_note(k for p in places for k in ((p.context_details or {}).get('overrides') or {}))
        return [changed] if changed else []
    return unique(_place_detail(problem, p) for p in places)


def _problem_notes(problem: Problem) -> list[str]:
    """Extra lines for the whole issue, e.g. what's on the master page or how big the bleed is."""
    facts = [p.context_details or {} for s in problem.subjects for p in s.places]
    if problem.key == 'MASTERPAGE':
        counts: dict[str, int] = {}
        for element in (e for f in facts for e in f.get('elements') or ()):
            counts[element['kind']] = counts.get(element['kind'], 0) + element['count']
        found = master_page_note(counts)
        return [found] if found else []
    if problem.key == 'DOCUMENT_BLEED':
        current = bleed_note(next((f['bleed'] for f in facts if f.get('bleed')), {}))
        return [current] if current else []
    if problem.key == 'PARAGRAPH_STYLE' and any(f.get('whitespace_only') for f in facts):
        return ['Tip: some of this is only spaces or empty lines after the text. Delete them, or give them a style too.']
    return []


# ------------------------------------------------------------------ Where the issue is

# InDesign's internal style names, as the panels show them.
_STYLE_NAMES = {'NormalParagraphStyle': '[Basic Paragraph]', 'NormalCharacterStyle': '[None]'}

_KIND_WORDS = {
    'paragraph-style': 'paragraph style',
    'character-style': 'character style',
    'font': 'font',
    'image': 'image',
    'frame': 'frame',
    'document': '',
}


@dataclass
class _FrameEntry:
    pages: dict[str, None] = field(default_factory=dict)  # an ordered set
    places: list[Place] = field(default_factory=list)
    details: list[str] = field(default_factory=list)


def _frames_where(problem: Problem, subjects: list[Subject]) -> str:
    """Frames are listed by their text, e.g. text frames “Title” (page 1), “Intro” (page 2) and 3 more."""
    named: dict[str, _FrameEntry] = {}
    unnamed_count = 0
    unnamed_pages: dict[str, None] = {}
    for s in subjects:
        place = s.places[0]
        if not s.name:
            unnamed_count += 1
            if place.page_name:
                unnamed_pages[place.page_name] = None
            continue
        entry = named.setdefault(f'“{_shorten(s.name)}”', _FrameEntry())
        if place.page_name:
            entry.pages[place.page_name] = None
        entry.places.extend(s.places)

    labels = unique(s.places[0].frame_label.lower() for s in subjects)
    word = labels[0] if len(labels) == 1 else 'frame'

    def first_page(entry: _FrameEntry) -> float:
        positions = [problem.page_names.index(p) if p in problem.page_names else math.inf for p in entry.pages]
        return min(positions, default=math.inf)

    for entry in named.values():
        entry.details = _places_details(problem, entry.places)
    entries = sorted(named.items(), key=lambda item: first_page(item[1]))
    shown = entries[:MAX_LISTED]

    def page_key(entry: _FrameEntry) -> Optional[str]:
        return None if entry.details else ','.join(entry.pages)

    # Frames on the same page share one page note: “Title”, “Intro” (page 1), “Footer” (page 2).
    names = []
    for i, (text, entry) in enumerate(shown):
        following = shown[i + 1][1] if i + 1 < len(shown) else None
        shares_page = following is not None and page_key(entry) is not None and page_key(entry) == page_key(following)
        page_note = _pages_text(list(entry.pages)) if entry.pages and not shares_page else ''
        notes = [n for n in [page_note, *entry.details] if n]
        names.append(f"{text} ({', '.join(notes)})" if notes else text)
    hidden = len(entries) - len(names)

    if not entries:
        pages = f' on {_pages_text(list(unnamed_pages))}' if unnamed_pages else ''
        return f'a {word}{pages}' if unnamed_count == 1 else f'{plural(unnamed_count, word)}{pages}'
    lead = f'the {word}' if len(entries) + unnamed_count == 1 else f'{word}s'
    text = f"{lead} {', '.join(names)}"
    more = hidden + unnamed_count
    return f'{text} and {more} more' if more else text


def _named_where(problem: Problem, kind: str, subjects: list[Subject]) -> str:
    """Styles, fonts and images are listed by name: styles with the pages they're used on at the end
    (paragraph styles “Title” and “Body”, used on page 1), images with their own pages (image “a.png” (page 2))."""
    names = []
    for s in subjects:
        pages = unique(p.page_name for p in s.places) if kind == 'image' else []
        notes = [n for n in [_pages_text(pages) if pages else '', *_places_details(problem, s.places)] if n]
        name = _shorten(_STYLE_NAMES.get(s.name or '', s.name or ''), 60)
        suffix = f" ({', '.join(notes)})" if notes else ''
        names.append(f'“{name}”{suffix}')
    shown = names[:MAX_LISTED]
    hidden = len(names) - len(shown)
    listed = f"{', '.join(shown)} and {hidden} more" if hidden else list_text(shown)
    is_style = kind in ('paragraph-style', 'character-style')
    pages = unique(p.page_name for s in subjects for p in s.places) if is_style else []
    used = f', used on {_pages_text([p for p in problem.page_names if p in pages])}' if pages else ''
    one = len(subjects) == 1
    return f"{'the ' if one else ''}{_KIND_WORDS[kind]}{'' if one else 's'} {listed}{used}"


def _where_line(problem: Problem) -> Optional[str]:
    by_kind: dict[str, list[Subject]] = {}
    for s in problem.subjects:
        if s.kind != 'document':
            by_kind.setdefault(s.kind, []).append(s)
    parts = [
        _frames_where(problem, subjects) if kind == 'frame' else _named_where(problem, kind, subjects)
        for kind, subjects in by_kind.items()
    ]
    return '; '.join(parts) if parts else None


# ------------------------------------------------------------------ Lines, sections, text and HTML


@dataclass(frozen=True)
class SummaryLine:
    """One line of the summary. The HTML, the plain text and the web app's review view are all rendered from these."""
    kind: str
    """'heading' | 'title' | 'text' | 'step' | 'link'"""
    text: str
    href: Optional[str] = None

    def to_dict(self) -> dict:
        return {'kind': self.kind, 'text': self.text, **({'href': self.href} if self.href else {})}


@dataclass(frozen=True)
class SummarySection:
    """One part of the summary: the intro, a group heading, a single issue, or the closing line."""
    key: str
    """What review feedback on it is filed under: an issue's check key (e.g. FONTS_INCLUDED), or 'intro' / 'closing'."""
    title: str
    lines: tuple[SummaryLine, ...]
    problem_id: Optional[str] = None
    """The issue this section describes (e.g. 'errors:FONTS_INCLUDED'), so the web app can show it on the page."""

    def to_dict(self) -> dict:
        return {
            'key': self.key,
            'title': self.title,
            'problem_id': self.problem_id,
            'lines': [line.to_dict() for line in self.lines],
        }


def _escape_html(text: str) -> str:
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def _review_line(line: SummaryLine) -> str:
    """How a line reads in the web app's review view: steps get a bullet, links read "Learn more"."""
    return f'• {line.text}' if line.kind == 'step' else line.text


def _plain_line(line: SummaryLine) -> str:
    """Plain-text copy: like the review view, with links written out."""
    return f'{line.text}: {line.href}' if line.kind == 'link' else _review_line(line)


def _lines_html(lines: tuple[SummaryLine, ...]) -> str:
    """HTML that Intercom keeps when pasted: bold titles with their details below, bullet lists, and links."""
    html = ''
    steps: list[str] = []
    paragraph: Optional[list[str]] = None

    def close_paragraph():
        nonlocal html, paragraph
        if paragraph is not None:
            html += f"<p>{'<br>'.join(paragraph)}</p>"
            paragraph = None

    def close_steps():
        nonlocal html, steps
        if steps:
            html += f"<ul>{''.join(f'<li>{s}</li>' for s in steps)}</ul>"
            steps = []

    for line in lines:
        text = _escape_html(line.text)
        if line.kind == 'step':
            close_paragraph()
            steps.append(text)
        elif line.kind == 'text' and paragraph is not None:
            paragraph.append(text)
        else:
            close_paragraph()
            close_steps()
            if line.kind == 'link':
                html += f'<p><a href="{_escape_html(line.href or "")}">{text}</a></p>'
            elif line.kind == 'heading':
                html += f'<p><strong>{text}</strong></p>'
            else:
                paragraph = [f'<strong>{text}</strong>' if line.kind == 'title' else text]
    close_paragraph()
    close_steps()
    return html


def _problem_lines(problem: Problem, number: int) -> tuple[SummaryLine, ...]:
    where = _where_line(problem)
    details = [d for d in [_first_sentence(problem.guide.why), where and f'Where: {where}', *_problem_notes(problem)] if d]
    return (
        SummaryLine('title', f'{number}. {problem.guide.title}'),
        *(SummaryLine('text', d) for d in details),
        *(SummaryLine('step', step) for step in problem.guide.fix),
        *([SummaryLine('link', 'Learn more', problem.help_article)] if problem.help_article else []),
    )


def display_template_name(template_name: str) -> str:
    """Removes the file extension so the message names the template, not the upload."""
    return re.sub(r'\.(zip|idml|indd)\Z', '', template_name, flags=re.I)


GROUP_HEADINGS = {
    'errors': 'Likely causes',
    'warnings': 'Possible contributing factors',
    'infos': 'Worth a quick check (often fine as is)',
}

_SECTION_GAP = '\n\n'


@dataclass(frozen=True)
class CustomerSummary:
    sections: tuple[SummarySection, ...]
    counts: dict[str, int]
    """Number of distinct issues per severity: errors (blockers), warnings, infos."""

    @property
    def review_text(self) -> str:
        """The message as the web app shows it for review (links read "Learn more")."""
        return _SECTION_GAP.join('\n'.join(_review_line(l) for l in s.lines) for s in self.sections)

    @property
    def plain_text(self) -> str:
        """The message as plain text, with links written out. For pasting where formatting isn't kept."""
        return _SECTION_GAP.join('\n'.join(_plain_line(l) for l in s.lines) for s in self.sections)

    @property
    def html(self) -> str:
        """The message as HTML, for pasting with formatting (e.g. into Intercom)."""
        return ''.join(_lines_html(s.lines) for s in self.sections)


def build_customer_summary(result: dict) -> CustomerSummary:
    """The customer summary for a checker result (the `results` object /run returns)."""
    problems = build_problems(result)
    counts = {sev: sum(1 for p in problems if p.severity == sev) for sev in GROUP_HEADINGS}
    groups = [(sev, [p for p in problems if p.severity == sev]) for sev in GROUP_HEADINGS if counts[sev]]
    blockers, warnings, infos = counts['errors'], counts['warnings'], counts['infos']

    clean_name = display_template_name(result.get('template_name') or 'Untitled template')
    name = f'“{clean_name}”' if clean_name and clean_name != 'No Name' else 'your template'

    if blockers:
        likely = f"{blockers} likely cause{'' if blockers == 1 else 's'}"
        possible = f" and {warnings} possible contributing factor{'' if warnings == 1 else 's'}" if warnings else ''
        intro = (f'Our review of {name} found {likely} of the problems in Frontify{possible}. '
                 'The recommended changes are below.')
    elif warnings:
        intro = (f"Our review of {name} found {warnings} possible contributing factor{'' if warnings == 1 else 's'} "
                 'to the problems in Frontify. The recommended changes are below.')
    elif infos:
        intro = (f'Our review of {name} found no likely causes of problems in Frontify. '
                 f"{'One item is' if infos == 1 else 'A few items are'} worth a quick check, though "
                 f"{'it is' if infos == 1 else 'they are'} often fine as is:")
    else:
        intro = f'Our review of {name} found nothing in the InDesign file that is likely to cause problems in Frontify.'
    sections = [SummarySection('intro', 'Introduction', (SummaryLine('text', intro),))]

    number = 0
    for severity, group in groups:
        if len(groups) > 1:
            sections.append(SummarySection('intro', 'Group heading', (SummaryLine('heading', GROUP_HEADINGS[severity]),)))
        for problem in group:
            number += 1
            sections.append(SummarySection(problem.key, problem.guide.title, _problem_lines(problem, number), problem.id))

    if groups:
        lead = 'Once that’s done' if blockers or warnings else 'If you change anything'
        sections.append(SummarySection('closing', 'Closing', (SummaryLine(
            'text',
            f'{lead}, package the document again with File > Package, zip the package folder and upload it to Frontify.',
        ),)))

    return CustomerSummary(sections=tuple(sections), counts=counts)
