import os
from typing import List, Dict
from lxml import etree as ET
from typing import Optional
from src.classes.StoryData import StoryData


# **********************************************************
# Class: StoriesParser
# Init Locations: FrontifyChecker
# Methods calls from: FrontifyChecker
# Method calls to: StoryData
# Description: A parser class to track and init StoryData objs.
# **********************************************************
class StoriesParser:
    def __init__(self, stories_dir: str, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', spreads_parser: 'SpreadsParser'):
        self.story_id = ''
        self.stories_data_list:  List[StoryData] = []
        self.stories_dict: Dict[str, StoryData] = {}
        self._extract_stories_data(
            stories_dir, styles_parser, fonts_parser, spreads_parser)

    # ---------------- Private Setters------------------
    def _extract_stories_data(self, stories_dir: str, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', spreads_parser: 'SpreadsParser'):
        for story_file in os.listdir(stories_dir):
            if story_file.endswith('.xml'):
                file_path = os.path.join(stories_dir, story_file)
                tree = ET.parse(file_path)
                root = tree.getroot()

                for story_element in root.findall("Story"):
                    story_data = StoryData(
                        spreads_parser, styles_parser, fonts_parser, story_element)
                    self.stories_data_list.append(story_data)
                    # Add to dictionary for O(1) lookups
                    self.stories_dict[story_data.story_id] = story_data

    # ----------------Getters------------------
    def get_story_by_id(self, story_id: str) -> Optional[StoryData]:
        """Returns the StoryData object for the given story_id."""
        return self.stories_dict.get(story_id)

    def get_stories_data(self) -> List[StoryData]:
        """Returns the list of extracted story data."""
        return self.stories_data_list

    def get_stories_length(self):
        return len(self.stories_data_list)

    # ----------------Debug Prints------------------
    def print_stories_data(self):
        """Prints the extracted story data for debugging purposes."""
        for story_data in self.stories_data_list:
            print(story_data)
            print("="*50)
