"""Groups checker results into problems: one per check, each listing what to fix and where."""
import math
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from .check_guides import CheckGuide, SubjectKind, get_check_guide

SEVERITIES = ('errors', 'warnings', 'infos')
CATEGORY_KEYS = ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')
_TEXT_CATEGORIES = ('text_boxes', 'par_styles', 'char_styles')

SUBJECT_LABELS: dict[str, str] = {
    'paragraph-style': 'Paragraph style',
    'character-style': 'Character style',
    'font': 'Font',
    'image': 'Image',
    'frame': 'Frame',
    'document': 'Document',
}


@dataclass
class Place:
    """One occurrence of a problem: usually a frame on a page."""
    item: dict
    category: str
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
    guide: CheckGuide
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


def _is_named(identifier: Any) -> bool:
    return bool(identifier) and identifier != 'null'


def _frame_label(bounds: Optional[dict], category: str) -> str:
    kind = (bounds or {}).get('kind')
    if kind == 'TextFrame' or category in _TEXT_CATEGORIES:
        return 'Text frame'
    if kind == 'Group':
        return 'Group'
    if category == 'images':
        return 'Image frame'
    if kind == 'GraphicLine':
        return 'Line'
    return 'Frame'


def _frame_text(item: dict, result: dict) -> Optional[str]:
    story_id = (item.get('identifier') or '').split('_par_')[0]
    story = (result.get('text_box_data') or {}).get(story_id) or {}
    text = collapse_whitespace(story.get('content'))
    if text is not None:
        return text
    first = next((t for t in item.get('text_content') or [] if isinstance(t, str) and t.strip()), None)
    return collapse_whitespace(first)


def _subject_for(kind: SubjectKind, place: Place) -> tuple[str, Optional[str], str]:
    """(key, name, label) of the thing to fix for this place."""
    item = place.item
    identifier = item.get('identifier')
    if kind in ('paragraph-style', 'character-style', 'font', 'image') and _is_named(identifier):
        return f'{kind}:{identifier}', identifier, f'{SUBJECT_LABELS[kind]} “{identifier}”'
    if kind == 'document' and not place.bounds:
        return 'document', None, 'Document'
    # Frame-level: each frame is its own thing to fix.
    data_id = item.get('data_id')
    frame_id = data_id if _is_named(data_id) else f"{identifier}:{item.get('page_id')}"
    label = f'{place.frame_label} “{place.frame_text}”' if place.frame_text else place.frame_label
    return f'frame:{frame_id}', place.frame_text, label


def _first_not_none(*values):
    return next((v for v in values if v is not None), None)


def build_problems(result: dict) -> list[Problem]:
    """The problems in a checker result, blockers first, then by how widespread they are."""
    page_index: dict[Any, dict] = {page.get('page_id'): page for page in result.get('page_layouts') or []}
    checks = result.get('checks') or []
    classifiers = result.get('validation_classifiers') or {}

    def check_for(severity: str, key: str) -> dict:
        return next((c for c in checks if c.get('severity') == severity and c.get('key') == key), {})

    problems: dict[str, Problem] = {}
    for category in CATEGORY_KEYS:
        details = (result.get(category) or {}).get('details') or {}
        for entries in details.values():
            for severity in SEVERITIES:
                for item in entries.get(severity) or []:
                    key = item.get('validationClassifier')
                    problem_id = f'{severity}:{key}'
                    problem = problems.get(problem_id)
                    if problem is None:
                        check = check_for(severity, key)
                        classifier = classifiers.get(key) or {}
                        problem = problems[problem_id] = Problem(
                            id=problem_id,
                            key=key,
                            severity=severity,
                            guide=get_check_guide(
                                severity, key,
                                label=_first_not_none(check.get('label'), classifier.get('label'), key),
                                message=_first_not_none(check.get('message'), classifier.get('message'), ''),
                            ),
                            help_article=_first_not_none(check.get('help_article'), classifier.get('help_article')),
                        )

                    raw_bounds = item.get('bounds')
                    bounds = raw_bounds if raw_bounds and raw_bounds.get('page_id') in page_index else None
                    page_id = bounds['page_id'] if bounds else item.get('page_id')
                    page_name = ((page_index.get(page_id) or {}).get('name') or item.get('page_name') or None) if page_id else None
                    place = Place(
                        item=item,
                        category=category,
                        bounds=bounds,
                        page_name=page_name,
                        frame_text=_frame_text(item, result),
                        frame_label=_frame_label(bounds, category),
                        context=item.get('context') or '',
                        context_details=item.get('context_details'),
                    )

                    subject_key, name, label = _subject_for(problem.guide.subject, place)
                    subject = next((s for s in problem.subjects if s.key == subject_key), None)
                    if subject is None:
                        kind = 'frame' if subject_key.startswith('frame:') else problem.guide.subject
                        subject = Subject(key=subject_key, kind=kind, name=name, label=label)
                        problem.subjects.append(subject)
                    subject.places.append(place)
                    problem.place_count += 1

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
        page_id = place.bounds['page_id'] if place.bounds else place.item.get('page_id')
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

