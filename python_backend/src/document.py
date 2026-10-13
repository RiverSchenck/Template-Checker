"""The parsed template every check reads: one object instead of a dozen attributes on the checker.

FrontifyChecker builds it after parsing (parse_xml). Checks only read it. A check can also be tested on
a hand-made ParsedDocument without unzipping a package; fields a check doesn't use can stay None.
"""
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from src.parsers.FontsParser import FontsParser
from src.parsers.MasterPageParser import MasterPageParser
from src.parsers.PreferencesParser import PreferencesParser
from src.parsers.SourceFoldersParser import SourceFoldersParser
from src.parsers.SpreadsParser import SpreadsParser
from src.parsers.StoriesParser import StoriesParser

# Styles InDesign creates itself. Using them (instead of a named style) is what several checks look for.
DEFAULT_PAR_STYLES = ("ParagraphStyle/$ID/NormalParagraphStyle", "ParagraphStyle/$ID/[No paragraph style]")
DEFAULT_OBJECT_STYLES = ('ObjectStyle/$ID/[None]',
                         'ObjectStyle/$ID/[Normal Graphics Frame]',
                         'ObjectStyle/$ID/[Normal Text Frame]')


@dataclass
class ParsedDocument:
    spreads_parser: Optional[SpreadsParser] = None
    stories_parser: Optional[StoriesParser] = None  # None when the IDML has no Stories/ folder
    masterspreads_parser: Optional[MasterPageParser] = None
    fonts_parser: Optional[FontsParser] = None
    source_folders_parser: Optional[SourceFoldersParser] = None
    preferences_parser: Optional[PreferencesParser] = None
    default_par_styles: Tuple[str, ...] = DEFAULT_PAR_STYLES
    default_object_styles: Tuple[str, ...] = DEFAULT_OBJECT_STYLES
    _data_id_to_page_id: Dict[str, str] = field(default_factory=dict, init=False, repr=False)

    def __post_init__(self):
        self._build_data_id_to_page_id_mapping()

    @property
    def stories_exist(self) -> bool:
        return self.stories_parser is not None

    def _build_data_id_to_page_id_mapping(self):
        """Pre-compute data_id to page_id mapping for O(1) lookups.
        Maps link rectangle IDs, text frame IDs, and page-item Self IDs (transform and wrap checks) to page IDs.
        """
        if not self.spreads_parser:
            return

        for spread in self.spreads_parser.spreads_obj_list:
            pages = spread.get_pages()
            if not pages or len(pages) == 0:
                continue
            page_id = pages[0].get("self", '')

            # Map link rectangle IDs to page_id
            for link in spread.links_obj_list:
                link_id = link.get_rectangle_link_id()
                if link_id:
                    self._data_id_to_page_id[link_id] = page_id

            # Map text frame IDs to page_id
            for text_frame in spread.text_frame_obj_list:
                frame_id = text_frame.frame_id
                if frame_id:
                    self._data_id_to_page_id[frame_id] = page_id

            for cand in spread.get_page_item_transform_candidates() + spread.wrap_items:
                cid = cand.get('self_id') or ''
                if cid:
                    self._data_id_to_page_id[cid] = page_id

    def find_page_id_from_data_id(self, data_id: str) -> str:
        """
        Find page_id (page Self) from data_id.
        data_id can be a rectangle_link_id (images), text_frame_id, or page-item Self (transform check).
        Returns the first page's Self from the spread containing the element, or empty string if not found.
        (When results are built, an item with known bounds is attributed to the page it's actually on.)
        """
        if not data_id or data_id == 'null':
            return ''

        return self._data_id_to_page_id.get(data_id, '')

    def frame_story_and_page(self, text_frame) -> tuple:
        """(story id, page Self) for a text frame. Uses its story when it has one; a frame whose story is
        missing from the package still gets its own story reference and the page it sits on."""
        story = text_frame.parent_story_obj
        if story is not None:
            return story.story_id, story.page_id
        return text_frame.parent_story_id, self.find_page_id_from_data_id(text_frame.frame_id)
