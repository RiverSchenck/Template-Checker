"""Styles.xml as data: every paragraph, character and object style, and property values resolved through BasedOn.

Parsed once. '$ID/' is handled here only: removed from values, and BasedOn is always a full style id. "No value"
is None (an attribute set to '' counts as unset, as in InDesign). A style's kind comes from its XML element, never
from its id.
"""
from dataclasses import dataclass
from typing import Dict, Mapping, Optional, Tuple

from src.helpers import safe_xml

KINDS = {'ParagraphStyle': 'paragraph', 'CharacterStyle': 'character', 'ObjectStyle': 'object'}
_ID = '$ID/'


@dataclass(frozen=True)
class Style:
    kind: str                   # paragraph | character | object
    id: str                     # Self, e.g. 'ParagraphStyle/Body' or 'ParagraphStyle/$ID/[No paragraph style]'
    name: str                   # Name, as InDesign shows it ('$ID/' removed)
    based_on: Optional[str]     # full style id, or None
    props: Mapping[str, str]    # what the style sets itself: attributes and Properties children


@dataclass(frozen=True)
class Resolved:
    value: Optional[str]
    source: Optional[str]       # id of the style the value is set on (the style itself or an ancestor); None if unset

    def inherited_from(self, style_id: str) -> Optional[str]:
        """The ancestor the value comes from, or None when the style sets it itself (or nothing does)."""
        return self.source if self.source and self.source != style_id else None


UNSET = Resolved(None, None)


def _value(text: Optional[str]) -> Optional[str]:
    """'$ID/' removed; None for no value ('' and a bare '$ID/' included)."""
    if text and text.startswith(_ID):
        text = text[len(_ID):]
    return text or None


class StyleSheet:
    def __init__(self, styles: Mapping[str, Style]):
        self.styles = dict(styles)
        self._resolved: Dict[Tuple[str, str], Resolved] = {}

    def get(self, style_id: Optional[str]) -> Optional[Style]:
        return self.styles.get(style_id) if style_id else None

    def resolve(self, style_id: Optional[str], prop: str) -> Resolved:
        """The value of prop for style_id: set on the style, else on the nearest BasedOn ancestor that sets it.
        UNSET when nothing in the chain sets it, the style is unknown or the chain loops."""
        key = (style_id, prop)
        if key not in self._resolved:
            self._resolved[key] = self._walk(style_id, prop)
        return self._resolved[key]

    def _walk(self, style_id: Optional[str], prop: str) -> Resolved:
        seen = set()
        style = self.get(style_id)
        while style is not None and style.id not in seen:
            seen.add(style.id)
            value = style.props.get(prop)
            if value is not None:
                return Resolved(value, style.id)
            style = self.get(style.based_on)
        return UNSET


def _style(element, kind_tag: str) -> Style:
    props = {}
    properties = element.find('Properties')
    for child in properties if properties is not None else ():
        props[child.tag] = child.text
    props.update((name, value) for name, value in element.attrib.items() if name not in ('Self', 'Name'))
    based_on = props.pop('BasedOn', None) or None
    if based_on and based_on.startswith(_ID):  # '$ID/[No paragraph style]' -> 'ParagraphStyle/$ID/[No paragraph style]'
        based_on = f'{kind_tag}/{based_on}'
    return Style(KINDS[kind_tag], element.get('Self'), _value(element.get('Name')) or '', based_on,
                 {name: v for name, v in ((n, _value(t)) for n, t in props.items()) if v is not None})


def load_styles(path: str) -> StyleSheet:
    root = safe_xml.parse(path).getroot()
    styles = {}
    for kind_tag in KINDS:
        for element in root.iter(kind_tag):
            style = _style(element, kind_tag)
            styles[style.id] = style
    return StyleSheet(styles)
