from xml.etree.ElementTree import Element
from typing import List
from src.classes.TextFrame import TextFrame
from src.classes.Link import Link


# **********************************************************
# Class: SpreadData
# Init Locations: SpreadsParser
# Methods calls from: SpreadsParser
# Method calls to: TextFrame, Link
# Description:
# **********************************************************
class SpreadData:
    def __init__(self, root: Element):
        self.page_name: str = ''
        self.child_stories: List['StoryData'] = []
        self.links_obj_list: List[Link] = []
        self.text_frame_obj_list: List[TextFrame] = []
        self.pasted_graphics_num: int = 0
        self.geometric_bounds: str = ''
        self._extract_spread_data(root)

    # ---------------- Private Setters------------------
    def _extract_spread_data(self, root: Element):
        spread = root.find(".//Spread")
        page = spread.find("Page")

        # Set Page Name
        self.page_name = page.get("Name")

        # Set Geometric bounds
        self.geometric_bounds = page.get("GeometricBounds")

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

    def _extract_pasted_graphics_data(self, root: Element) -> int:
        pasted_graphics_num = 0

        # Loop through all the <Rectangle> elements.
        for rectangle_element in root.findall(".//Rectangle"):
            # Pasted Graphics do not have a link, while QR codes and such do.
            if rectangle_element.find('.//Link') is None:
                # Check for children <PDF>, <EPS>, or <Image>.
                for graphic_type in ['PDF', 'EPS', 'Image']:
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
                link_obj = Link(link_element)
            except Exception as e:
                print(f"Link data error: {e}")
            links_obj_list.append(link_obj)

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

    # ---------------- External Setters------------------

    # ----------------Getters------------------

    def get_page_name(self) -> str:
        return self.page_name

    def get_geographic_bounds(self) -> str:
        return self.geometric_bounds

    def get_links_obj_list(self) -> List[Link]:
        return self.links_obj_list

    def get_pasted_graphics_num(self) -> int:
        return self.pasted_graphics_num

    def get_text_frame_obj_list(self) -> List[TextFrame]:
        return self.text_frame_obj_list

    def get_child_stories(self) -> List['StoryData']:
        return self.child_stories

    # ---------------- Debug Prints ------------------
    def print_links_data(self):
        for link_data in self.links_obj_list:
            print(link_data)

    # ----------------String Method------------------
    def __str__(self):
        link_names = [link.link_name for link in self.links_obj_list]
        return f"Page Name: {self.page_name}, Stories: {', '.join(self.child_stories)}, Links: {', '.join(link_names)}"
