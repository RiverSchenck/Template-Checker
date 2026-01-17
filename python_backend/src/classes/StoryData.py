from typing import List
from xml.etree.ElementTree import Element
from src.classes.StoryParagraphData import StoryParagraphData
from src.classes.StoryCharacterData import StoryCharacterData


# **********************************************************
# Class: StoryData
# Init Locations: StoriesParser
# Methods calls from: StoriesParser
# Method calls to: StoryParagraphData, StoryCharacterData, SpreadsParser
# Description: A class to hold and manage story data.
# **********************************************************
class StoryData:
    def __init__(self, spreads_parser: 'SpreadsParser', styles_parser: 'StylesParser', fonts_parser: 'FontsParser', story_element: Element):
        self.story_id: str = ''
        self.paragraph_styles: List[StoryParagraphData] = []
        self.character_styles: List[StoryCharacterData] = []
        self.parent_text_frame_id: str = ''
        self._extract_story_data(
            styles_parser, fonts_parser, story_element)
        self.grouped_paragraph_styles: List[List[StoryParagraphData]
                                            ] = self._extract_grouped_styles()
        self.page: str = spreads_parser.get_page_by_story_id(self.story_id)
        self.page_id: str = spreads_parser.get_page_id_by_story_id(self.story_id)

    # ---------------- Private Setters------------------

    def _extract_story_data(self, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', story_element: Element):
        self.story_id = story_element.get("Self")

        # Extract Paragraph Styles
        index = 0
        for par_style_range in story_element.findall(".//ParagraphStyleRange"):
            par_style = StoryParagraphData(
                index, par_style_range, styles_parser, fonts_parser)
            self.add_paragraph_style(par_style)
            index += 1

            # Extract Character Styles within the Paragraph Style
            for char_style_range in par_style_range.findall("CharacterStyleRange"):
                char_style = StoryCharacterData(
                    char_style_range, fonts_parser, styles_parser)
                self.add_character_style(char_style)
                par_style.add_child_char_style(char_style)

    def _extract_grouped_styles(self) -> List[List[StoryParagraphData]]:
        grouped_paragraph_styles = []
        current_group = []
        for par_style in self.paragraph_styles:
            style_id = par_style.get_style_id()

            # Check if the current group is empty or if the style_id matches the last element's style_id
            if not current_group or style_id == current_group[-1].get_style_id():
                current_group.append(par_style)
            else:
                # If the style_id is different, add the current group to the list and start a new group
                grouped_paragraph_styles.append(current_group)
                current_group = [par_style]

        # Add the last group if it's not empty
        if current_group:
            grouped_paragraph_styles.append(current_group)
        return grouped_paragraph_styles

    # ---------------- External Setters------------------

    def add_paragraph_style(self, par_style: StoryParagraphData):
        if isinstance(par_style, StoryParagraphData):
            self.paragraph_styles.append(par_style)

    def add_character_style(self, char_style: StoryCharacterData):
        if isinstance(char_style, StoryCharacterData):
            self.character_styles.append(char_style)

    def add_parent_text_frame_id(self, frame_id: str):
        self.parent_text_frame_id = frame_id

    # ----------------Getters------------------
    def get_grouped_paragraph_styles(self) -> List[List[StoryParagraphData]]:
        return self.grouped_paragraph_styles

    def get_story_id(self):
        return self.story_id

    def get_paragraph_styles(self) -> List[StoryParagraphData]:
        return self.paragraph_styles

    def get_character_styles(self) -> List[StoryCharacterData]:
        return self.character_styles

    def get_story_text_content(self) -> str:
        return ''.join(char_style.get_content() for char_style in self.character_styles if char_style.get_content())

    def get_page(self) -> str:
        return self.page

    def get_page_id(self) -> str:
        return self.page_id

    def get_all_fonts(self) -> List[str]:
        return [char_style.applied_font for char_style in self.character_styles if char_style.applied_font]

    def get_content(self):
        full_text = ""
        for par_style in sorted(self.paragraph_styles, key=lambda x: x.index):
            full_text += par_style.get_content() + "\n"
        return full_text

    def get_parent_text_frame_id(self):
        return self.parent_text_frame_id

    # ----------------String Method------------------
    def __str__(self):
        return f"Story ID: {self.story_id}\n" + \
            f"Page: {self.page}\n" + \
            "\n".join(str(par_style) for par_style in self.paragraph_styles) + "\n" + \
            "\n".join(str(char_style) for char_style in self.character_styles)
