"""Plain-language copy for each check, per v1 classifier, as the customer summary and the web app's check guides
use it. The wording itself is in the catalogue (src/results/catalogue.py), the only copy of it; this module only
looks it up per v1 key (removed with results v1, plan PR 5.5).
"""
from dataclasses import dataclass
from typing import Literal, Optional

from src.results import catalogue
from src.results.classifiers import all_classifiers

SubjectKind = Literal['paragraph-style', 'character-style', 'font', 'image', 'frame', 'document']

# Catalogue subject kinds -> how the summary and the web app group a problem's places.
_SUBJECT = {'paragraph_style': 'paragraph-style', 'character_style': 'character-style', 'font': 'font',
            'image': 'image', 'image_frame': 'image', 'text_frame': 'frame', 'story': 'frame', 'page_item': 'frame',
            'document': 'document'}


@dataclass(frozen=True)
class CheckGuide:
    title: str
    """Short plain-language name of the problem."""
    why: str
    """What goes wrong in Frontify, in a sentence or two."""
    fix: tuple[str, ...]
    """How the template author fixes it in InDesign."""
    subject: SubjectKind
    """What the problem is tied to, which decides how its places are grouped."""


def _guide(name: str) -> CheckGuide:
    entry, kind = catalogue.for_v1(name)
    return CheckGuide(catalogue.v1_title(name), entry.why, entry.fix_for(kind), _SUBJECT[kind])


# {severity: {v1 key: guide}} for every check (package and parsing failures have no guide).
GUIDES: dict[str, dict[str, CheckGuide]] = {}
for _classifier in all_classifiers():
    if catalogue.for_v1(_classifier.name)[0].is_check:
        GUIDES.setdefault(_classifier.severity.value, {})[_classifier.name] = _guide(_classifier.name)


def get_check_guide(severity: str, key: str, label: Optional[str] = None, message: Optional[str] = None) -> CheckGuide:
    """The guide for a check. Package and parsing errors get their catalogue title; a key the catalogue doesn't know
    (results from an older checker) falls back to the label and message it came with."""
    guide = GUIDES.get(severity, {}).get(key)
    if guide:
        return guide
    found = catalogue.for_v1(key)
    if found:
        entry, _ = found
        return CheckGuide(title=entry.title, why=entry.why, fix=(), subject='document')
    return CheckGuide(title=label or message or key, why=message or '', fix=(), subject='document')
