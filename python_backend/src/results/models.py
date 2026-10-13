"""Results v2, the contract (plan §4.3, D7). serialize.results_v2 writes it; every golden validates against these
models; schema/results-v2.json is generated from them, and the web app's TypeScript types from that (PR 5.3, which
also makes /v1/checks send it under `results`).

    python -m src.results.models    # rewrite schema/results-v2.json
"""
import json
import os
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict

from src.results import catalogue
from src.results.facts import (AutoSizeFacts, BleedFacts, InheritedFacts, MasterPageFacts, MissingFontFacts,
                               OverrideFacts, ParagraphStyleFacts, SizeFacts, TransformationFacts)

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'schema', 'results-v2.json')

CheckKey = Literal[tuple(catalogue.BY_KEY)]
Severity = Literal['error', 'warning', 'info']
SubjectKind = Literal['paragraph_style', 'character_style', 'text_frame', 'image', 'image_frame', 'font', 'page_item',
                      'document']
AnyFacts = Union[InheritedFacts, AutoSizeFacts, SizeFacts, MasterPageFacts, BleedFacts, ParagraphStyleFacts,
                 OverrideFacts, MissingFontFacts, TransformationFacts]


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', use_attribute_docstrings=True)


class Subject(Model):
    """What the issue is about. Styles: id is the style's Self, name as InDesign shows it. Text frames and image
    frames: the frame's Self (a story's Self for text not in a frame). Images and fonts: the file or family name.
    Page items: Self, named by kind. The document: no id."""
    kind: SubjectKind
    id: Optional[str]
    name: Optional[str]


class Bounds(Model):
    """Where an item is on its page, in points from the page's top left."""
    page_id: str
    x: float
    y: float
    width: float
    height: float
    kind: str
    """The item's tag, e.g. TextFrame."""


class Location(Model):
    page_id: Optional[str]
    page_name: Optional[str]
    spread_id: Optional[str]
    item_id: Optional[str]
    """Self of the page item it points at."""
    bounds: Optional[Bounds]


class Issue(Model):
    check: CheckKey
    severity: Severity
    subject: Subject
    location: Location
    facts: Optional[AnyFacts]
    """The check's facts (its facts model in the catalogue), or null."""
    text: Optional[List[str]]
    """The text it's about, when relevant."""
    detail: Optional[str]
    """Short display text. Never parse it: facts hold the data."""


class Page(Model):
    id: str
    name: str
    index: int
    spread_id: Optional[str]
    width: float
    height: float
    preview: Optional[str]
    """Base64 JPEG, when previews were asked for."""
    frames: List[Bounds]


class TextBox(Model):
    content: str
    page_id: Optional[str]


class Check(Model):
    """A catalogue entry: the only copy of a check's wording."""
    key: CheckKey
    severity: Severity
    subject_kinds: List[SubjectKind]
    title: str
    why: str
    fix: Dict[SubjectKind, List[str]]
    """Steps in InDesign, per kind of subject."""
    help_article: Optional[str]
    is_check: bool
    """False for package and parsing failures, which aren't listed among the checks a template passed."""


class Results(Model):
    schema_version: Literal[2]
    template_name: str
    issues: List[Issue]
    """Every issue, in the order found."""
    subjects_checked: Dict[SubjectKind, int]
    pages: List[Page]
    """In document order."""
    text_boxes: Dict[str, TextBox]
    """The text of each text frame an issue is about, by subject id."""
    checks: List[Check]


def schema_json() -> str:
    return json.dumps(Results.model_json_schema(), indent=2, ensure_ascii=False) + '\n'


if __name__ == '__main__':
    with open(SCHEMA_PATH, 'w', encoding='utf-8') as f:
        f.write(schema_json())
