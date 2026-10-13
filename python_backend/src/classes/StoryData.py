from typing import List
from src.classes.StoryParagraphData import StoryParagraphData
from src.classes.StoryCharacterData import StoryCharacterData
from src.model.text import Story


class StoryData:
    """A class to hold and manage story data."""
    def __init__(self, spreads_parser: 'SpreadsParser', styles_parser: 'StylesParser', fonts_parser: 'FontsParser', story: Story):
        self.story_id: str = ''
        self.paragraph_styles: List[StoryParagraphData] = []
        self.character_styles: List[StoryCharacterData] = []
        self.parent_text_frame_id: str = ''
        self._extract_story_data(
            styles_parser, fonts_parser, story)
        self.grouped_paragraph_styles: List[List[StoryParagraphData]
                                            ] = self._extract_grouped_styles()
        # Self of the first page of the spread this story's frame is on (the item's own page comes from
        # page geometry when results are built).
        self.page_id: str = spreads_parser.get_page_by_story_id(self.story_id)


    def _extract_story_data(self, styles_parser: 'StylesParser', fonts_parser: 'FontsParser', story: Story):
        self.story_id = story.id

        # Notes are editorial (never printed): their text isn't checked (decided 2026-10-13).
        paragraphs = [paragraph for paragraph in story.paragraphs if paragraph.container != 'note']
        for index, paragraph in enumerate(paragraphs):
            par_style = StoryParagraphData(
                index, paragraph, styles_parser, fonts_parser)
            self.add_paragraph_style(par_style)

            # Extract Character Styles within the Paragraph Style
            for run in paragraph.runs:
                char_style = StoryCharacterData(
                    run, fonts_parser, styles_parser)
                self.add_character_style(char_style)
                par_style.add_child_char_style(char_style)
                # The font the text is set in, wherever it comes from (text, character style, paragraph).
                font, _ = char_style.effective("AppliedFont")
                font_style, _ = char_style.effective("FontStyle")
                fonts_parser.add_used_face(font, font_style)

    def _extract_grouped_styles(self) -> List[List[StoryParagraphData]]:
        grouped_paragraph_styles = []
        current_group = []
        for par_style in self.paragraph_styles:
            style_id = par_style.style_id

            # Check if the current group is empty or if the style_id matches the last element's style_id
            if not current_group or style_id == current_group[-1].style_id:
                current_group.append(par_style)
            else:
                # If the style_id is different, add the current group to the list and start a new group
                grouped_paragraph_styles.append(current_group)
                current_group = [par_style]

        # Add the last group if it's not empty
        if current_group:
            grouped_paragraph_styles.append(current_group)
        return grouped_paragraph_styles

    def add_paragraph_style(self, par_style: StoryParagraphData):
        if isinstance(par_style, StoryParagraphData):
            self.paragraph_styles.append(par_style)

    def add_character_style(self, char_style: StoryCharacterData):
        if isinstance(char_style, StoryCharacterData):
            self.character_styles.append(char_style)

    def get_story_text_content(self) -> str:
        return ''.join(char_style.get_content() for char_style in self.character_styles if char_style.get_content())

    def get_content(self):
        full_text = ""
        for par_style in sorted(self.paragraph_styles, key=lambda x: x.index):
            full_text += par_style.get_content() + "\n"
        return full_text

    def __str__(self):
        return f"Story ID: {self.story_id}\n" + \
            f"Page: {self.page_id}\n" + \
            "\n".join(str(par_style) for par_style in self.paragraph_styles) + "\n" + \
            "\n".join(str(char_style) for char_style in self.character_styles)
