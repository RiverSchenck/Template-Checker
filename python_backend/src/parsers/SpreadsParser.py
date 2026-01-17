import os
from typing import List, Dict
from lxml import etree as ET
from src.classes.SpreadData import SpreadData


# **********************************************************
# Class: SpreadsParser
# Init Locations: FrontifyChecker
# Methods calls from: StoryData
# Method calls to: SpreadData
# Description:
# **********************************************************
class SpreadsParser:
    def __init__(self, spreads_xml_dir: str):
        self.spreads_obj_list: List[SpreadData] = self._extract_spreads_data(
            spreads_xml_dir)
        # Build dictionaries for O(1) lookups
        self.story_id_to_page: Dict[str, str] = {}
        self.story_id_to_page_id: Dict[str, str] = {}
        self._build_story_id_mappings()

    # ---------------- Private Setters------------------
    def _extract_spreads_data(self, spreads_xml_dir: str):
        spreads_obj_list: List[SpreadData] = []

        # Iterate over each file in the directory
        for filename in os.listdir(spreads_xml_dir):
            if filename.endswith('.xml'):
                file_path = os.path.join(spreads_xml_dir, filename)
                parser = ET.XMLParser(huge_tree=True)
                tree = ET.parse(file_path, parser)
                root = tree.getroot()

                spread_data = SpreadData(root)
                spreads_obj_list.append(spread_data)
        return spreads_obj_list

    # ---------------- Private Setters------------------
    def _build_story_id_mappings(self):
        """Build dictionaries mapping story_id to page and page_id for O(1) lookups."""
        for spread_data in self.spreads_obj_list:
            page_name = spread_data.page_name
            page_id = spread_data.page_id
            for story_id in spread_data.get_child_stories():
                self.story_id_to_page[story_id] = page_name
                self.story_id_to_page_id[story_id] = page_id

    # ----------------Getters------------------
    def get_spreads_obj_list(self):
        return self.spreads_obj_list

    def get_page_by_story_id(self, story_id: str):
        return self.story_id_to_page.get(story_id)

    def get_page_id_by_story_id(self, story_id: str):
        return self.story_id_to_page_id.get(story_id)

    # ----------------Debug Prints------------------
    def print_spreads_obj_list(self):
        for spread_data in self.spreads_obj_list:
            print(spread_data)
