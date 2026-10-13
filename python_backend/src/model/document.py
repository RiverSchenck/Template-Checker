"""The template every check reads: the document model (styles, layout, text, assets) plus the lookups the
checks need, computed once when the Document is made.

load_document (src/model/load.py) builds it from an unpacked package. A test can also make one by hand
(Document(spreads=..., stories=...)); anything it leaves out is empty.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Mapping, Optional, Set, Tuple

from src.model.assets import FontCatalog, FontFamily, PackagedFont, PackagedImage
from src.model.layout import Link, Spread, TextFrame
from src.model.styles import StyleSheet
from src.model.text import Paragraph, Run, Story

# Styles InDesign creates itself. Using them (instead of a named style) is what several checks look for.
DEFAULT_PAR_STYLES = ("ParagraphStyle/$ID/NormalParagraphStyle", "ParagraphStyle/$ID/[No paragraph style]")
DEFAULT_OBJECT_STYLES = ('ObjectStyle/$ID/[None]',
                         'ObjectStyle/$ID/[Normal Graphics Frame]',
                         'ObjectStyle/$ID/[Normal Text Frame]')
NO_CHARACTER_STYLE = "CharacterStyle/$ID/[No character style]"
_ID = '$ID/'

# Page items whose page is looked up by id (transform and wrap checks report them).
_LOCATED_KINDS = frozenset({'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'})


def short_style_id(style_id: Optional[str]) -> Optional[str]:
    """'ParagraphStyle/$ID/[No paragraph style]' -> '[No paragraph style]', 'CharacterStyle/Bold' -> 'Bold'."""
    if style_id is None:
        return None
    for prefix in ('ParagraphStyle/$ID/', 'ParagraphStyle/', 'CharacterStyle/$ID/', 'CharacterStyle/'):
        if style_id.startswith(prefix):
            return style_id[len(prefix):]
    return style_id


@dataclass(frozen=True)
class Document:
    styles: StyleSheet = field(default_factory=lambda: StyleSheet({}))
    spreads: Tuple[Spread, ...] = ()        # in the order checks report them
    masters: Tuple[Spread, ...] = ()
    stories: Optional[Tuple[Story, ...]] = None  # None when the IDML has no Stories folder
    font_catalog: FontCatalog = field(default_factory=lambda: FontCatalog(()))
    packaged_images: Tuple[PackagedImage, ...] = ()
    packaged_fonts: Tuple[PackagedFont, ...] = ()
    bleed: Optional[Mapping[str, Optional[str]]] = None  # DocumentBleed*Offset by side; None without preferences
    geometry: Optional[object] = None       # PageGeometryIndex
    default_par_styles: Tuple[str, ...] = DEFAULT_PAR_STYLES
    default_object_styles: Tuple[str, ...] = DEFAULT_OBJECT_STYLES

    # Computed in __post_init__.
    item_page: Mapping[str, str] = field(init=False, repr=False, default=None)
    story_page: Mapping[str, str] = field(init=False, repr=False, default=None)
    story_frame: Mapping[str, str] = field(init=False, repr=False, default=None)
    stories_by_id: Mapping[str, Story] = field(init=False, repr=False, default=None)
    used_fonts: Tuple[FontFamily, ...] = field(init=False, repr=False, default=())
    _used_faces: Mapping[str, Set[str]] = field(init=False, repr=False, default=None)
    _paragraph_faces: Mapping[str, Set[str]] = field(init=False, repr=False, default=None)
    _placed: Mapping[Optional[str], List] = field(init=False, repr=False, default=None)
    _placed_links: Mapping[Optional[str], List[Link]] = field(init=False, repr=False, default=None)

    def __post_init__(self):
        item_page: Dict[str, str] = {}
        story_page: Dict[str, str] = {}
        story_frame: Dict[str, str] = {}
        for spread in self.spreads:
            page_id = spread.pages[0].id if spread.pages else ''
            for item in spread.items:
                if item.kind in _LOCATED_KINDS and item.id:
                    item_page[item.id] = page_id
                if isinstance(item, TextFrame) and item.story_id:
                    story_page[item.story_id] = page_id     # a story threaded across spreads: the last one
                    story_frame[item.story_id] = item.id
            for link in spread.links:
                if link.frame_id:
                    item_page[link.frame_id] = page_id
        # Items placed in a story's text (inline or anchored) belong to the spread and page of the story's frame.
        story_spread = {story_id: spread for spread in self.spreads for frame in spread.text_frames
                        if (story_id := frame.story_id)}
        placed: Dict[Optional[str], List] = {}
        placed_links: Dict[Optional[str], List[Link]] = {}
        for story in self.stories or ():
            spread = story_spread.get(story.id)
            # The page the story's frame is on (from its position when known), else its spread's first page.
            bounds = self.geometry.get_bounds(story_frame.get(story.id)) if self.geometry else None
            page_id = bounds['page_id'] if bounds else story_page.get(story.id, '')
            for _, run in self.runs(story):
                for item in run.items:
                    placed.setdefault(spread.id if spread else None, []).append(item)
                    if item.id:
                        item_page[item.id] = page_id
                    if isinstance(item, TextFrame) and item.story_id:
                        story_page[item.story_id] = page_id
                        story_frame[item.story_id] = item.id
                        if spread is not None:
                            story_spread[item.story_id] = spread
                for link in run.links:
                    placed_links.setdefault(spread.id if spread else None, []).append(link)
                    if link.frame_id:
                        item_page[link.frame_id] = page_id
        object.__setattr__(self, '_placed', placed)
        object.__setattr__(self, '_placed_links', placed_links)
        object.__setattr__(self, 'item_page', item_page)
        object.__setattr__(self, 'story_page', story_page)
        object.__setattr__(self, 'story_frame', story_frame)
        object.__setattr__(self, 'stories_by_id', {story.id: story for story in self.stories or ()})
        self._collect_used_fonts()

    # --- text ------------------------------------------------------------------------------------------------

    @property
    def stories_exist(self) -> bool:
        return self.stories is not None

    def paragraphs(self, story: Story) -> List[Paragraph]:
        """The story's paragraphs that are checked: notes are editorial, never printed (decided 2026-10-13)."""
        return [paragraph for paragraph in story.paragraphs if paragraph.container != 'note']

    def runs(self, story: Story) -> List[Tuple[Paragraph, Run]]:
        return [(paragraph, run) for paragraph in self.paragraphs(story) for run in paragraph.runs]

    def story_text(self, story: Story) -> str:
        """The story's text, one line per paragraph range."""
        return ''.join(paragraph.text + '\n' for paragraph in self.paragraphs(story))

    def effective(self, paragraph: Paragraph, run: Run, prop: str) -> Tuple[Optional[str], str]:
        """The value InDesign applies to a run's text, and where it comes from: set on the text itself, its
        character style (through BasedOn), the paragraph range, the paragraph style (through BasedOn). The
        source is '' for the text itself, else the style id the value was found in. (None, '') when nothing
        sets it."""
        local = run.attrs[prop] if prop in run.attrs else run.properties.get(prop)  # an attribute wins
        if local:
            return _value(local), ''
        if run.style and run.style != NO_CHARACTER_STYLE:
            resolved = self.styles.resolve(run.style, prop)
            if resolved.value:
                return resolved.value, resolved.source
        local = paragraph.attrs.get(prop) or paragraph.properties.get(prop)
        if local:
            return _value(local), ''
        if paragraph.style:
            resolved = self.styles.resolve(paragraph.style, prop)
            if resolved.value:
                return resolved.value, resolved.source
        return None, ''

    # --- where things are -------------------------------------------------------------------------------------

    def page_of_item(self, item_id: Optional[str]) -> str:
        """The first page of the spread a page item (or a link's frame) is on; '' if unknown."""
        if not item_id or item_id == 'null':
            return ''
        return self.item_page.get(item_id, '')

    def story_of_frame(self, frame: TextFrame) -> Optional[Story]:
        return self.stories_by_id.get(frame.story_id) if frame.story_id else None

    def page_items(self):
        """(spread, item) for every page item: on the spreads, then placed in each spread's stories (inline or
        anchored), then placed in stories that aren't on a spread (spread None)."""
        return [(spread, item) for spread in self._containers()
                for item in (spread.items if spread else ()) + tuple(self._placed.get(spread.id if spread else None, ()))]

    def text_frames(self):
        """(spread, text frame) for every text frame, in report order (page_items, text frames only)."""
        return [(spread, item) for spread, item in self.page_items() if isinstance(item, TextFrame)]

    def links(self):
        """(spread, link) for every placed file outside master pages, in report order (like page_items)."""
        return [(spread, link) for spread in self._containers()
                for link in (spread.links if spread else ()) + tuple(self._placed_links.get(spread.id if spread else None, ()))]

    def _containers(self):
        return list(self.spreads) + ([None] if None in self._placed or None in self._placed_links else [])

    def frame_of_image(self, image_name: str) -> Optional[str]:
        """The frame of the (last) placed link with this file name; '' when no link places it."""
        frames = {link.name: link.frame_id for _, link in self.links()}
        return frames.get(image_name, '')

    # --- fonts --------------------------------------------------------------------------------------------

    def faces_used_with(self, family: str) -> Set[str]:
        """Styles of this family the text uses; for a family only paragraph styles name, their styles."""
        return self._used_faces.get(family) or self._paragraph_faces.get(family, set())

    def _collect_used_fonts(self):
        """Families the text uses, in the order they're first met: each paragraph style's font, then each run's
        own font and the font its text is set in."""
        used: List[FontFamily] = []
        used_faces: Dict[str, Set[str]] = {}
        paragraph_faces: Dict[str, Set[str]] = {}

        def use(name):
            family = self.font_catalog.family(name)
            if family is not None and family not in used:
                used.append(family)

        for story in self.stories or ():
            for paragraph in self.paragraphs(story):
                font = self.styles.resolve(paragraph.style, 'AppliedFont').value
                use(font)
                if font:
                    paragraph_faces.setdefault(font, set()).add(
                        self.styles.resolve(paragraph.style, 'FontStyle').value or 'Regular')
                for run in paragraph.runs:
                    if run.properties.get('AppliedFont') is not None:
                        use(run.properties['AppliedFont'])
                    font, _ = self.effective(paragraph, run, 'AppliedFont')
                    style, _ = self.effective(paragraph, run, 'FontStyle')
                    use(font)
                    if font:
                        used_faces.setdefault(font, set()).add(style or 'Regular')
        object.__setattr__(self, 'used_fonts', tuple(used))
        object.__setattr__(self, '_used_faces', used_faces)
        object.__setattr__(self, '_paragraph_faces', paragraph_faces)


def _value(text: str) -> str:
    return text[len(_ID):] if text.startswith(_ID) else text
