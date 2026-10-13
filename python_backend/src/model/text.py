"""Stories as data: paragraphs and runs, read by one recursive walk over the story XML.

What the walk handles (plan B1-B4, B6):
- runs and text inside HyperlinkTextSource, XMLElement and Change elements (pending deletions are left out);
- text after a special character (<?ACE n?>): processing instructions add nothing, the text around them stays;
- paragraphs inside table cells, footnotes and notes keep their container instead of being flattened into the
  body text around them;
- page items placed in a run (inline or anchored images, frames, groups) are collected on the run;
- a run's Properties are always read.
"""
import os
from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Tuple

from src.helpers import safe_xml
from src.model.layout import ITEM_TAGS, Link, PageItem, local_tag, read_item, read_link

CONTAINERS = {'Cell': 'table', 'Footnote': 'footnote', 'Note': 'note'}  # where a paragraph can sit besides the body
DELETED = 'DeletedText'


@dataclass(frozen=True)
class Run:
    style: Optional[str]                    # AppliedCharacterStyle
    attrs: Mapping[str, str]                # the range's other attributes (formatting set on the text)
    properties: Mapping[str, Optional[str]]  # the range's Properties children (AppliedFont...)
    text: str
    has_table: bool
    items: Tuple[PageItem, ...]             # page items placed in the run (inline or anchored), at any depth
    links: Tuple[Link, ...]                 # files placed in those items


@dataclass(frozen=True)
class Paragraph:
    style: Optional[str]                    # AppliedParagraphStyle
    attrs: Mapping[str, str]
    properties: Mapping[str, Optional[str]]
    runs: Tuple[Run, ...]
    container: str                          # body | table | footnote | note

    @property
    def text(self) -> str:
        return ''.join(run.text for run in self.runs)


@dataclass(frozen=True)
class Story:
    id: str
    paragraphs: Tuple[Paragraph, ...]       # document order; a paragraph inside a table cell, footnote or note
                                            # comes right after the paragraph it's anchored in


def _properties(element) -> Dict[str, Optional[str]]:
    properties = element.find('Properties')
    return {child.tag: child.text for child in properties if isinstance(child.tag, str)} if properties is not None else {}


def _attrs(element, style_attribute: str) -> Dict[str, str]:
    return {name: value for name, value in element.attrib.items() if name != style_attribute}


def _is_deleted(element) -> bool:
    return local_tag(element) == 'Change' and element.get('ChangeType') == DELETED


class _Walker:
    """Collects a story's paragraphs. Paragraph ranges can sit at any depth; each one's runs are the character
    ranges beneath it that don't belong to a deeper paragraph."""

    def __init__(self):
        self.paragraphs: List[Paragraph] = []

    def walk(self, element, container: str):
        for child in element:
            tag = local_tag(child)
            if not tag or _is_deleted(child):
                continue
            if tag == 'ParagraphStyleRange':
                self.paragraph(child, container)
            else:
                self.walk(child, CONTAINERS.get(tag, container))

    def paragraph(self, element, container: str):
        position = len(self.paragraphs)
        self.paragraphs.append(None)  # keep document order: nested paragraphs found below come after this one
        runs = tuple(self.runs(element, container))
        self.paragraphs[position] = Paragraph(element.get('AppliedParagraphStyle'), _attrs(element, 'AppliedParagraphStyle'),
                                              _properties(element), runs, container)

    def runs(self, element, container: str):
        for child in element:
            tag = local_tag(child)
            if not tag or _is_deleted(child):
                continue
            if tag == 'CharacterStyleRange':
                yield self.run(child, container)
            elif tag == 'ParagraphStyleRange':  # a paragraph range inside another one (rare): its own paragraph
                self.paragraph(child, container)
            else:                               # HyperlinkTextSource, XMLElement, Change... around runs
                yield from self.runs(child, CONTAINERS.get(tag, container))

    def run(self, element, container: str) -> Run:
        text, items, links = [], [], []
        self._content(element, container, text, items, links)
        return Run(element.get('AppliedCharacterStyle'), _attrs(element, 'AppliedCharacterStyle'), _properties(element),
                   ''.join(text), element.find('Table') is not None, tuple(items), tuple(links))

    def _content(self, element, container, text, items, links):
        """The run's text, and the page items placed in it. Paragraphs inside it (cells, footnotes, notes) are
        their own paragraphs; text inside page items (an anchored frame's story) belongs to that story."""
        for child in element:
            tag = local_tag(child)
            if not tag or _is_deleted(child) or tag == 'Properties':
                continue
            if tag == 'Content':
                text.append(''.join(child.itertext()))
            elif tag == 'ParagraphStyleRange':
                self.paragraph(child, container)
            elif tag in ITEM_TAGS:
                items.append(read_item(child))
                items.extend(read_item(e) for e in child.iter() if e is not child and local_tag(e) in ITEM_TAGS)
                links.extend(read_link(e) for e in child.iter() if local_tag(e) == 'Link')
            else:
                self._content(child, CONTAINERS.get(tag, container), text, items, links)


def read_story(element) -> Story:
    walker = _Walker()
    walker.walk(element, 'body')
    return Story(element.get('Self') or '', tuple(walker.paragraphs))


def load_stories(stories_folder: str) -> Tuple[Story, ...]:
    """Every story in the Stories folder, by file name."""
    if not os.path.isdir(stories_folder):
        return ()
    stories = []
    for name in sorted(os.listdir(stories_folder)):
        if name.endswith('.xml'):
            root = safe_xml.parse(os.path.join(stories_folder, name), large=True).getroot()
            stories.extend(read_story(element) for element in root.findall('Story'))
    return tuple(stories)
