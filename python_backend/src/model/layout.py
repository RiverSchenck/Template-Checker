"""Spreads and master spreads as data: pages, page items and placed links, plus where each item sits on its page.

Spreads and master spreads go through the same code, in designmap.xml order. Each file is parsed once; the
same trees give the page geometry (PageGeometryIndex), so nothing is read twice.
"""
import logging
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

from src.helpers import safe_xml
from src.helpers.file_names import normalize_file_name, unquote_uri
from src.helpers.page_geometry import PageGeometryIndex

ITEM_TAGS = frozenset({'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'})
GRAPHIC_FRAME_TAGS = frozenset({'Rectangle', 'Oval', 'Polygon'})
PASTED_TYPES = ('PDF', 'EPS', 'Image', 'SVG')  # graphics pasted into a frame, stored inline (no Link)

logger = logging.getLogger(__name__)


def local_tag(element) -> str:
    tag = element.tag if isinstance(element.tag, str) else ''
    return tag.split('}', 1)[-1]


@dataclass(frozen=True)
class Page:
    id: str
    name: str
    spread_id: str


@dataclass(frozen=True)
class Link:
    """A placed file: the Link, the graphic it belongs to (Image, PDF, EPS...) and the frame holding that."""
    id: str
    uri: str                        # LinkResourceURI, unquoted
    name: str                       # the file name, normalized
    stored_state: Optional[str]     # 'Embedded' when stored in the document
    graphic_id: Optional[str]
    graphic_transform: Optional[str]
    graphic_object_style: Optional[str]
    frame_id: Optional[str]
    frame_transform: Optional[str]
    frame_object_style: Optional[str]


@dataclass(frozen=True)
class PageItem:
    kind: str                       # TextFrame, Rectangle, Oval, Polygon, GraphicLine or Group
    id: str
    transform: Optional[str]        # ItemTransform
    object_style: Optional[str]
    wrap: Optional[str]             # TextWrapMode; None when the item has no TextWrapPreference
    has_link: bool                  # holds a placed (linked or embedded) file
    pasted: Optional[str]           # graphic frames: the type of graphic pasted into it (PDF, EPS, Image, SVG)


@dataclass(frozen=True)
class TextFrame(PageItem):
    story_id: Optional[str]
    previous_frame: Optional[str]   # PreviousTextFrame ('n' when none)
    next_frame: Optional[str]
    columns: Optional[str]          # TextColumnCount
    auto_size: Optional[str]        # AutoSizingType
    auto_size_reference_point: Optional[str]
    no_line_breaks: Optional[str]   # UseNoLineBreaksForAutoSizing


@dataclass(frozen=True)
class Spread:
    id: str
    is_master: bool
    pages: Tuple[Page, ...]
    items: Tuple[PageItem, ...]     # every page item at any depth (inside groups too), in document order
    links: Tuple[Link, ...]
    child_tags: Tuple[str, ...]     # tags of the spread's direct children ('Page', 'TextFrame'...)
    source: str = ''                # the file it was read from, relative to the IDML folder

    @property
    def text_frames(self) -> Tuple[TextFrame, ...]:
        return tuple(item for item in self.items if isinstance(item, TextFrame))


@dataclass(frozen=True)
class Layout:
    spreads: Tuple[Spread, ...]     # designmap order
    masters: Tuple[Spread, ...]
    geometry: PageGeometryIndex     # pages and item bounds, from the spreads (not the masters)


def _pref(element, tag: str, attribute: str) -> Optional[str]:
    pref = element.find(tag)
    return pref.get(attribute) if pref is not None else None


def _pasted(frame) -> Optional[str]:
    for graphic_type in PASTED_TYPES:
        contents = frame.find(f'{graphic_type}/Properties/Contents')
        if contents is not None and contents.text:
            return graphic_type
    return None


def read_item(element) -> PageItem:
    kind = local_tag(element)
    has_link = element.find('.//Link') is not None
    common = dict(kind=kind, id=element.get('Self') or '', transform=element.get('ItemTransform'),
                  object_style=element.get('AppliedObjectStyle'),
                  wrap=_pref(element, 'TextWrapPreference', 'TextWrapMode'), has_link=has_link,
                  pasted=_pasted(element) if kind in GRAPHIC_FRAME_TAGS and not has_link else None)
    if kind != 'TextFrame':
        return PageItem(**common)
    return TextFrame(**common, story_id=element.get('ParentStory'), previous_frame=element.get('PreviousTextFrame'),
                     next_frame=element.get('NextTextFrame'),
                     columns=_pref(element, 'TextFramePreference', 'TextColumnCount'),
                     auto_size=_pref(element, 'TextFramePreference', 'AutoSizingType'),
                     auto_size_reference_point=_pref(element, 'TextFramePreference', 'AutoSizingReferencePoint'),
                     no_line_breaks=_pref(element, 'TextFramePreference', 'UseNoLineBreaksForAutoSizing'))


def read_link(element) -> Optional[Link]:
    """The Link, or None for a malformed one without a LinkResourceURI (it's skipped, as InDesign can't use it)."""
    if element.get('LinkResourceURI') is None:
        logger.warning('Skipping link %s without a LinkResourceURI', element.get('Self'))
        return None
    graphic = element.getparent()
    frame = graphic.getparent() if graphic is not None else None
    uri = unquote_uri(element.get('LinkResourceURI'))
    return Link(element.get('Self'), uri, normalize_file_name(uri.split('/')[-1]), element.get('StoredState'),
                *((graphic.get('Self'), graphic.get('ItemTransform'), graphic.get('AppliedObjectStyle'))
                  if graphic is not None else (None, None, None)),
                *((frame.get('Self'), frame.get('ItemTransform'), frame.get('AppliedObjectStyle'))
                  if frame is not None else (None, None, None)))


def read_spread(element, is_master: bool = False, source: str = '') -> Spread:
    """A <Spread> or <MasterSpread> element as data, in one pass over its tree."""
    spread_id = element.get('Self') or ''
    pages = tuple(Page(page.get('Self'), page.get('Name') or '', spread_id)
                  for page in element.findall('Page') if page.get('Self'))
    items, links = [], []
    for child in element.iter():
        tag = local_tag(child)
        if tag in ITEM_TAGS:
            items.append(read_item(child))
        elif tag == 'Link':
            link = read_link(child)
            if link is not None:
                links.append(link)
    return Spread(spread_id, is_master, pages, tuple(items), tuple(links),
                  tuple(local_tag(child) for child in element if local_tag(child)), source)


def _sources(idml_folder: str, designmap, kind: str, folder: str) -> List[str]:
    """Paths of the spread (kind='Spread') or master spread files, in designmap order. Without a designmap
    entry for them, the folder's files sorted by name."""
    sources = [element.get('src') for element in (designmap.iter() if designmap is not None else ())
               if local_tag(element) == kind and element.get('src')]
    if sources:
        return [path for path in (safe_xml.within(idml_folder, src) for src in sources)
                if path and os.path.exists(path)]
    directory = os.path.join(idml_folder, folder)
    if not os.path.isdir(directory):
        return []
    return [os.path.join(directory, name) for name in sorted(os.listdir(directory)) if name.endswith('.xml')]


def load_layout(idml_folder: str) -> Layout:
    designmap_path = os.path.join(idml_folder, 'designmap.xml')
    designmap = safe_xml.parse(designmap_path).getroot() if os.path.exists(designmap_path) else None
    spread_elements = []
    for path in _sources(idml_folder, designmap, 'Spread', 'Spreads'):
        element = safe_xml.parse(path, large=True).getroot().find('.//Spread')
        if element is not None:
            spread_elements.append((element, os.path.relpath(path, idml_folder)))
    masters = []
    for path in _sources(idml_folder, designmap, 'MasterSpread', 'MasterSpreads'):
        element = safe_xml.parse(path, large=True).getroot().find('MasterSpread')
        if element is not None:
            masters.append(read_spread(element, is_master=True, source=os.path.relpath(path, idml_folder)))
    return Layout(tuple(read_spread(element, source=source) for element, source in spread_elements), tuple(masters),
                  PageGeometryIndex(spreads=[element for element, _ in spread_elements]))
