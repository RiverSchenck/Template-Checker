import logging
from xml.etree.ElementTree import Element
from typing import List, Dict, Any
from src.classes.TextFrame import TextFrame
from src.classes.Link import Link

logger = logging.getLogger(__name__)


def _xml_local_tag(tag: str) -> str:
    if tag and '}' in tag:
        return tag.split('}', 1)[-1]
    return tag or ''


_PAGE_ITEM_TRANSFORM_TAGS = frozenset(
    {'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'Group'})

# Items other than text frames that can carry text wrap (text frames have their own TextFrame.text_wrap_mode).
_WRAP_ITEM_TAGS = frozenset({'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'})

# Frames that can hold a placed or pasted graphic, and the graphic elements InDesign writes inside them.
_GRAPHIC_FRAME_TAGS = ('Rectangle', 'Oval', 'Polygon')
_GRAPHIC_TYPES = ('PDF', 'EPS', 'Image', 'SVG')


class SpreadData:
    def __init__(self, root: Element):
        self.spread_self: str = ''
        self.first_page_self: str = ''  # Self (id) of the spread's first page
        self.first_page_name: str = ''  # Name (e.g. "1") of the spread's first page
        self.pages: List[Dict[str, str]] = []  # List of pages with Self and Name
        self.child_stories: List['StoryData'] = []
        self.links_obj_list: List[Link] = []
        self.text_frame_obj_list: List[TextFrame] = []
        self.pasted_graphics_num: int = 0
        self.geometric_bounds: str = ''
        self.page_item_transform_candidates: List[Dict[str, Any]] = []
        self.wrap_items: List[Dict[str, str]] = []
        self._extract_spread_data(root)

    def _extract_spread_data(self, root: Element):
        spread = root.find(".//Spread")

        # Extract Spread Self
        self.spread_self = spread.get("Self") if spread is not None else ''

        # Extract all pages (not just the first one)
        pages = spread.findall("Page") if spread is not None else []

        # Store all pages with their Self and Name
        self.pages = []
        for page in pages:
            page_self = page.get("Self")
            page_name = page.get("Name")
            if page_self:
                self.pages.append({
                    "self": page_self,
                    "name": page_name if page_name else ""
                })

        # Set first page for backward compatibility
        if pages and len(pages) > 0:
            first_page = pages[0]
            self.first_page_self = first_page.get("Self", '')
            self.first_page_name = first_page.get("Name", '')
            # Set Geometric bounds from first page
            self.geometric_bounds = first_page.get("GeometricBounds", '')

        # Extract links and associate them with spread_data
        extracted_links = self._extract_links_data(root)
        self.links_obj_list = extracted_links

        # Find Pasted Graphics num
        self.pasted_graphics_num = self._extract_pasted_graphics_data(
            root)

        # Extract all stories associated with this page
        for story_element in root.findall(f".//*[@ParentStory]"):
            story_id = story_element.get("ParentStory")
            if story_id:
                self._add_story(story_id)

        # Extract Text Frames
        self.text_frame_obj_list = self._extract_text_frames(root)

        self.page_item_transform_candidates = self._extract_page_item_transform_candidates(
            root)

        self.wrap_items = self._extract_wrap_items(root)

    def _extract_wrap_items(self, root: Element) -> List[Dict[str, str]]:
        """Images, shapes, lines and groups with text wrap on. In InDesign wrap is set on the object text
        flows around, not on the text frame. A missing TextWrapPreference means no wrap (InDesign's default)."""
        spread = root.find(".//Spread")
        if spread is None:
            return []
        out: List[Dict[str, str]] = []
        for el in spread.iter():
            tag = _xml_local_tag(el.tag)
            if tag not in _WRAP_ITEM_TAGS:
                continue
            pref = el.find('TextWrapPreference')
            mode = pref.get('TextWrapMode') if pref is not None else None
            if mode not in (None, 'None'):
                out.append({'tag': tag, 'self_id': el.get('Self') or '', 'mode': mode})
        return out

    def _extract_page_item_transform_candidates(self, root: Element) -> List[Dict[str, Any]]:
        spread = root.find(".//Spread")
        if spread is None:
            return []
        out: List[Dict[str, Any]] = []
        for el in spread.iter():
            tag = _xml_local_tag(el.tag)
            if tag not in _PAGE_ITEM_TRANSFORM_TAGS:
                continue
            if tag == 'Rectangle' and el.find('.//Link') is not None:
                continue
            item_transform = el.get('ItemTransform')
            if not item_transform or not str(item_transform).strip():
                continue
            self_id = el.get('Self') or ''
            out.append({
                'tag': tag,
                'self_id': self_id,
                'item_transform': item_transform,
            })
        return out

    def _extract_pasted_graphics_data(self, root: Element) -> int:
        pasted_graphics_num = 0

        # Every frame that can hold a graphic (a logo pasted into a circle is an Oval).
        frames = [frame for tag in _GRAPHIC_FRAME_TAGS for frame in root.findall(f".//{tag}")]
        for rectangle_element in frames:
            # Pasted Graphics do not have a link, while QR codes and such do.
            if rectangle_element.find('.//Link') is None:
                # Check for children <PDF>, <EPS>, <Image> or <SVG>.
                for graphic_type in _GRAPHIC_TYPES:
                    graphic_element = rectangle_element.find(graphic_type)

                    if graphic_element is not None:
                        # Check the child <Properties> of the graphic element.
                        properties_element = graphic_element.find('Properties')

                        if properties_element is not None:
                            # Check the <Content> child of the <Properties> element.
                            content_element = properties_element.find(
                                'Contents')

                            if content_element is not None and content_element.text:
                                # If the <Content> has any text, increment the counter.
                                pasted_graphics_num += 1
                                # No need to check other graphic types for this rectangle.
                                break

        return pasted_graphics_num

    def _extract_links_data(self, root: Element) -> List[Link]:
        links_obj_list = []
        for link_element in root.findall(".//Link"):
            try:
                links_obj_list.append(Link(link_element))
            except Exception:
                logger.warning('Skipping unreadable link %s', link_element.get('Self'), exc_info=True)

        return links_obj_list

    def _extract_text_frames(self, root: Element) -> List[TextFrame]:
        text_frames = []
        for frame_element in root.findall(".//TextFrame"):
            text_frame = TextFrame(frame_element)
            text_frames.append(text_frame)
        return text_frames

    def _add_story(self, story_id: str):
        if story_id not in self.child_stories:
            self.child_stories.append(story_id)

    def get_pages(self) -> List[Dict[str, str]]:
        return self.pages

    def get_page_item_transform_candidates(self) -> List[Dict[str, Any]]:
        return self.page_item_transform_candidates

    def __str__(self):
        link_names = [link.link_name for link in self.links_obj_list]
        return f"First page: {self.first_page_name}, Stories: {', '.join(self.child_stories)}, Links: {', '.join(link_names)}"
