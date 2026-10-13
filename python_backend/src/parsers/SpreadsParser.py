import os
from typing import List, Dict
from src.helpers import safe_xml
from src.classes.SpreadData import SpreadData


class SpreadsParser:
    def __init__(self, spreads_xml_dir: str):
        self.spreads_obj_list: List[SpreadData] = self._extract_spreads_data(
            spreads_xml_dir)
        # Build dictionaries for O(1) lookups
        self.story_id_to_page: Dict[str, str] = {}
        self._build_story_id_mappings()

    def _extract_spreads_data(self, spreads_xml_dir: str):
        spreads_obj_list: List[SpreadData] = []

        # Iterate over each file in the directory
        for filename in sorted(os.listdir(spreads_xml_dir)):
            if filename.endswith('.xml'):
                file_path = os.path.join(spreads_xml_dir, filename)
                tree = safe_xml.parse(file_path, large=True)
                root = tree.getroot()

                spread_data = SpreadData(root)
                spreads_obj_list.append(spread_data)
        return spreads_obj_list

    def _build_story_id_mappings(self):
        """story_id -> Self of the first page of the spread the story's frame is on."""
        for spread_data in self.spreads_obj_list:
            for story_id in spread_data.child_stories:
                self.story_id_to_page[story_id] = spread_data.first_page_self

    def get_page_by_story_id(self, story_id: str):
        return self.story_id_to_page.get(story_id)
