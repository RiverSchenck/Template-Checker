"""What an issue is about (results v2, plan §4.3): a style, a text frame, an image, a font, a page item or the
document. The kind decides how its id reads; the name is what people see."""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Subject:
    kind: str
    """paragraph_style, character_style, text_frame, image, image_frame, font, page_item or document"""
    id: Optional[str] = None
    name: Optional[str] = None


DOCUMENT = Subject('document')


def _is_id(value: Optional[str]) -> bool:
    return value not in (None, '', 'null')


def style(styles, kind: str, style_id: Optional[str]) -> Subject:
    """A paragraph or character style: its Self, shown by its name in InDesign."""
    found = styles.get(style_id) if style_id else None
    return Subject(kind, style_id, found.name if found else None)


def text_frame(story_id: Optional[str], frame_id: Optional[str]) -> Subject:
    """A text frame, by its Self; by its story's Self when the story isn't in a frame."""
    return Subject('text_frame', frame_id if _is_id(frame_id) else story_id)


def image(file_name: str) -> Subject:
    """An image file, wherever it's placed."""
    return Subject('image', file_name, file_name)


def image_frame(frame_id: Optional[str], file_name: str) -> Subject:
    """The frame an image is placed in."""
    return Subject('image_frame', frame_id if _is_id(frame_id) else None, file_name)


def font(name: str) -> Subject:
    return Subject('font', name, name)


def page_item(item) -> Subject:
    """An image, shape, line or group, named by its kind (e.g. Rectangle)."""
    return Subject('page_item', item.id or None, item.kind)
