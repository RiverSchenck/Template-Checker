from typing import List, Dict
from typing import Optional
from src.classes.StoryData import StoryData
from src.model.text import load_stories


class StoriesParser:
    """A parser class to track and init StoryData objs."""
    def __init__(self, stories_dir: str, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', spreads_parser: 'SpreadsParser'):
        self.story_id = ''
        self.stories_data_list:  List[StoryData] = []
        self.stories_dict: Dict[str, StoryData] = {}
        self._extract_stories_data(
            stories_dir, styles_parser, fonts_parser, spreads_parser)

    def _extract_stories_data(self, stories_dir: str, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', spreads_parser: 'SpreadsParser'):
        # The text model (src/model/text.py) reads the story XML; these classes wrap it until checks read the model.
        for story in load_stories(stories_dir):
            story_data = StoryData(spreads_parser, styles_parser, fonts_parser, story)
            self.stories_data_list.append(story_data)
            # Add to dictionary for O(1) lookups
            self.stories_dict[story_data.story_id] = story_data

    def get_story_by_id(self, story_id: str) -> Optional[StoryData]:
        """Returns the StoryData object for the given story_id."""
        return self.stories_dict.get(story_id)

    def get_stories_length(self):
        return len(self.stories_data_list)
