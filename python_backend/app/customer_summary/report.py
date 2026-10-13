"""Groups checker results (v2) into problems: one per check, each listing what to fix and where."""
import math
from dataclasses import dataclass, field
from typing import Any, Iterable, Literal, Optional

from src.results import catalogue
from src.results.serialize import check_json

SEVERITIES = ('errors', 'warnings', 'infos')
# Severity in results v2 -> how the summary groups problems (the web app's report does the same).
SEVERITY_LIST = {'error': 'errors', 'warning': 'warnings', 'info': 'infos'}

SubjectKind = Literal['paragraph-style', 'character-style', 'font', 'image', 'frame', 'document']

# Subject kinds (v2) -> how the summary groups a problem's places.
_SUBJECT = {'paragraph_style': 'paragraph-style', 'character_style': 'character-style', 'font': 'font',
            'image': 'image', 'image_frame': 'image', 'text_frame': 'frame', 'page_item': 'frame',
            'document': 'document'}
_TEXT_KINDS = ('text_frame', 'paragraph_style', 'character_style')
_IMAGE_KINDS = ('image', 'image_frame')

# When a problem's places are of several kinds whose fix differs, each kind's steps start with what they're for.
FIX_LEADS = {'text_frame': 'Text frames', 'image': 'Images', 'image_frame': 'Image frames',
             'page_item': 'Other items', 'paragraph_style': 'Paragraph styles',
             'character_style': 'Character styles', 'font': 'Fonts', 'document': 'Document'}
# An object style is applied to the image's frame, so its steps are for image frames (River, 2026-10-13).
_FIX_LEAD_OF = {('OBJECT_STYLE', 'image'): 'Image frames'}

SUBJECT_LABELS: dict[str, str] = {
    'paragraph-style': 'Paragraph style',
    'character-style': 'Character style',
    'font': 'Font',
    'image': 'Image',
    'frame': 'Frame',
    'document': 'Document',
}


@dataclass(frozen=True)
class Guide:
    title: str
    """Short plain-language name of the problem."""
    why: str
    """What goes wrong in Frontify, in a sentence or two."""
    fix: tuple[str, ...]
    """How the template author fixes it in InDesign."""


@dataclass
class Place:
    """One occurrence of a problem: usually a frame on a page."""
    issue: dict
    bounds: Optional[dict]
    page_name: Optional[str]
    frame_text: Optional[str]
    """Text inside the frame, when it has any."""
    frame_label: str
    context: str
    context_details: Optional[dict]


@dataclass
class Subject:
    """What to fix: a style, font, image file, frame, or the document itself."""
    key: str
    kind: SubjectKind
    name: Optional[str]
    label: str
    places: list[Place] = field(default_factory=list)


@dataclass
class Problem:
    id: str
    key: str
    severity: str
    """errors, warnings or infos"""
    guide: Guide
    help_article: Optional[str]
    subjects: list[Subject] = field(default_factory=list)
    place_count: int = 0
    page_names: list[str] = field(default_factory=list)
    """Page names the problem appears on, in document order."""


def unique(values: Iterable[Optional[str]]) -> list[str]:
    """The non-empty values, without duplicates, in first-seen order."""
    return list(dict.fromkeys(v for v in values if v))


# Invisible characters InDesign text can contain that str.split() doesn't count as whitespace.
_INVISIBLE = str.maketrans({'\ufeff': ' ', '\u200b': ' ', '\u200c': ' ', '\u200d': ' ', '\u2060': ' '})


def collapse_whitespace(text: Optional[str]) -> Optional[str]:
    """Text with runs of whitespace as single spaces, or None when there's nothing but whitespace."""
    if not text:
        return None
    return ' '.join(text.translate(_INVISIBLE).split()) or None


def page_number(name: Any) -> float:
    """A page name as a number ("3" -> 3.0), or NaN for names like "A" or "iv"."""
    try:
        return float(str(name).strip())
    except ValueError:
        return math.nan


def _frame_label(bounds: Optional[dict], subject_kind: str) -> str:
    kind = (bounds or {}).get('kind')
    if kind == 'TextFrame' or subject_kind in _TEXT_KINDS:
        return 'Text frame'
    if kind == 'Group':
        return 'Group'
    if subject_kind in _IMAGE_KINDS:
        return 'Image frame'
    if kind == 'GraphicLine':
        return 'Line'
    return 'Frame'


def _frame_text(issue: dict, result: dict) -> Optional[str]:
    subject = issue['subject']
    if subject['kind'] == 'text_frame':
        box = (result.get('text_boxes') or {}).get(subject['id']) or {}
        text = collapse_whitespace(box.get('content'))
        if text is not None:
            return text
    first = next((t for t in issue.get('text') or [] if isinstance(t, str) and t.strip()), None)
    return collapse_whitespace(first)


def _subject_for(kind: SubjectKind, place: Place) -> tuple[str, Optional[str], str]:
    """(key, name, label) of the thing to fix for this place."""
    subject, location = place.issue['subject'], place.issue['location']
    name = subject.get('name')
    if kind in ('paragraph-style', 'character-style', 'font', 'image') and name:
        return f'{kind}:{name}', name, f'{SUBJECT_LABELS[kind]} “{name}”'
    if kind == 'document' and not place.bounds:
        return 'document', None, 'Document'
    # Frame-level: each frame is its own thing to fix.
    frame_id = location.get('item_id') or f"{subject.get('id')}:{location.get('page_id')}"
    label = f'{place.frame_label} “{place.frame_text}”' if place.frame_text else place.frame_label
    return f'frame:{frame_id}', place.frame_text, label


def _check(result: dict, key: str) -> dict:
    """The check as the result lists it; from the catalogue for results that don't; else made from its key (a
    check this checker no longer has)."""
    listed = next((c for c in result.get('checks') or [] if c.get('key') == key), None)
    if listed is not None:
        return listed
    entry = catalogue.BY_KEY.get(key)
    return check_json(entry) if entry else {'title': key, 'why': '', 'fix': {}, 'subject_kinds': []}


def _guide(check: dict, kinds: list[str]) -> Guide:
    """The check's wording; when its places are of several kinds with different steps, each kind's steps, led by
    what they're for."""
    fix = check.get('fix') or {}
    present = [kind for kind in check.get('subject_kinds') or [] if kind in kinds and kind in fix]
    steps = [tuple(fix[kind]) for kind in present]
    title, why = check.get('title') or '', check.get('why') or ''
    if len(set(steps)) <= 1:
        return Guide(title, why, steps[0] if steps else ())
    return Guide(title, why, tuple(
        f"{_FIX_LEAD_OF.get((check.get('key'), kind)) or FIX_LEADS[kind]}: {step}" if i == 0 else step
        for kind, kind_steps in zip(present, steps) for i, step in enumerate(kind_steps)))


def build_problems(result: dict) -> list[Problem]:
    """The problems in a checker result (results v2), blockers first, then by how widespread they are."""
    page_index: dict[Any, dict] = {page.get('id'): page for page in result.get('pages') or []}

    problems: dict[str, Problem] = {}
    kinds: dict[str, list[str]] = {}
    for issue in result.get('issues') or []:
        key, severity = issue.get('check'), SEVERITY_LIST[issue.get('severity')]
        problem_id = f'{severity}:{key}'
        problem = problems.get(problem_id)
        if problem is None:
            problem = problems[problem_id] = Problem(
                id=problem_id, key=key, severity=severity, guide=Guide(key, '', ()),
                help_article=_check(result, key).get('help_article'))
        subject_kind = issue['subject']['kind']
        kinds.setdefault(problem_id, []).append(subject_kind)

        location = issue.get('location') or {}
        raw_bounds = location.get('bounds')
        bounds = raw_bounds if raw_bounds and raw_bounds.get('page_id') in page_index else None
        page_id = bounds['page_id'] if bounds else location.get('page_id')
        page_name = ((page_index.get(page_id) or {}).get('name') or location.get('page_name') or None) if page_id else None
        place = Place(
            issue=issue,
            bounds=bounds,
            page_name=page_name,
            frame_text=_frame_text(issue, result),
            frame_label=_frame_label(bounds, subject_kind),
            context=issue.get('detail') or '',
            context_details=issue.get('facts'),
        )

        kind = _SUBJECT.get(subject_kind, 'document')
        subject_key, name, label = _subject_for(kind, place)
        subject = next((s for s in problem.subjects if s.key == subject_key), None)
        if subject is None:
            subject = Subject(key=subject_key, kind='frame' if subject_key.startswith('frame:') else kind,
                              name=name, label=label)
            problem.subjects.append(subject)
        subject.places.append(place)
        problem.place_count += 1
    for problem_id, problem in problems.items():
        problem.guide = _guide(_check(result, problem.key), kinds[problem_id])

    pages_by_name = {}
    for page in page_index.values():
        pages_by_name.setdefault(page.get('name'), page)

    def page_order(name: str) -> float:
        index = (pages_by_name.get(name) or {}).get('index')
        if index is not None:
            return index
        number = page_number(name)
        return number if math.isfinite(number) else math.inf

    def place_order(place: Place) -> float:
        page_id = place.bounds['page_id'] if place.bounds else (place.issue.get('location') or {}).get('page_id')
        index = (page_index.get(page_id) or {}).get('index')
        return index if index is not None else math.inf

    def coord(place: Place, axis: str) -> float:
        return (place.bounds or {}).get(axis) or 0

    for problem in problems.values():
        for subject in problem.subjects:
            subject.places.sort(key=lambda p: (place_order(p), coord(p, 'y'), coord(p, 'x')))
        problem.subjects.sort(key=lambda s: (
            -len(s.places), place_order(s.places[0]), coord(s.places[0], 'y'), s.label.casefold(), s.label,
        ))
        problem.page_names = sorted(unique(p.page_name for s in problem.subjects for p in s.places), key=page_order)

    return sorted(problems.values(), key=lambda p: (
        SEVERITIES.index(p.severity), -p.place_count, p.guide.title.casefold(), p.guide.title,
    ))


def _number_text(value: float) -> str:
    return str(int(value)) if value == int(value) else str(value)


def format_pages(names: list[str]) -> str:
    """Joins page names into a short range like "1–3, 5"; names that aren't whole numbers are just listed."""
    if not names:
        return ''
    numbers = [page_number(n) for n in names]
    if not all(math.isfinite(n) and n == int(n) for n in numbers):
        return ', '.join(names)
    ranges = []
    start = prev = numbers[0]
    for n in numbers[1:] + [math.nan]:
        if n == prev + 1:
            prev = n
            continue
        ranges.append(_number_text(start) if start == prev else f'{_number_text(start)}–{_number_text(prev)}')
        start = prev = n
    return ', '.join(ranges)

