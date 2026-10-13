"""What the results JSON needs to know about the document: its pages, where items are, page previews and the
text of each text box. Built once from the Document (pages_from_spreads, text_boxes_from_stories), so turning
results into JSON never reaches into parsing."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class TextBox:
    content: str
    page_id: str
    """Self of the first page of its spread; its frame's position gives the exact page when known."""
    frame_id: Optional[str]


@dataclass
class DocumentLayout:
    pages: Dict[str, str] = field(default_factory=dict)
    """Page Self -> page name, in document order."""
    spread_to_pages: Dict[str, List[str]] = field(default_factory=dict)
    """Spread Self -> its pages' Selfs."""
    geometry: Optional[object] = None
    """PageGeometryIndex: where page items are, for highlighting. None when unavailable."""
    previews: Dict[str, str] = field(default_factory=dict)
    """Page Self -> base64 JPEG preview."""
    text_boxes: Dict[str, TextBox] = field(default_factory=dict)
    """Text box by story Self, and by text frame Self (override issues are grouped by frame)."""

    def bounds(self, item_id: Optional[str]) -> Optional[dict]:
        """Where a page item is on its page, or None if unknown."""
        return self.geometry.get_bounds(item_id) if self.geometry and item_id else None

    def page_of(self, item_id: Optional[str], fallback_page_id: Optional[str]) -> str:
        """The page an item is on: from its position when known (e.g. the right page of a spread), else the
        fallback."""
        bounds = self.bounds(item_id)
        if bounds and bounds.get('page_id'):
            return bounds['page_id']
        return fallback_page_id or ''

    def page_name(self, page_id: str) -> str:
        return self.pages.get(page_id, '') if page_id else ''

    def spread_of(self, page_id: str) -> str:
        return next((spread for spread, pages in self.spread_to_pages.items() if page_id in pages), '') \
            if page_id else ''


def pages_from_spreads(doc) -> DocumentLayout:
    """A layout with the document's pages and spreads (geometry, previews and text boxes are added later)."""
    layout = DocumentLayout()
    for spread in doc.spreads:
        page_ids = [page.id for page in spread.pages]
        if spread.id and page_ids:
            layout.spread_to_pages[spread.id] = page_ids
        for page in spread.pages:
            layout.pages[page.id] = page.name
    return layout


def text_boxes_from_stories(doc) -> Dict[str, TextBox]:
    """Each story's text, by story Self and by the Self of the frame it's in."""
    boxes: Dict[str, TextBox] = {}
    for story in doc.stories or ():
        frame_id = doc.story_frame.get(story.id) or None
        box = TextBox(doc.story_text(story), doc.story_page.get(story.id) or '', frame_id)
        boxes[story.id] = box
        if frame_id and frame_id != 'null':
            boxes.setdefault(frame_id, box)
    return boxes
