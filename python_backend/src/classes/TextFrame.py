from xml.etree.ElementTree import Element
# **********************************************************
# Class:TextFrame
# Init Locations: SpreadData
# Methods calls from:
# Method calls to:
# Description: Parses textFrame XML. Stores data related to textFrames.
# **********************************************************


class TextFrame:
    def __init__(self, frame_element: Element):
        self.frame_id: str = ''
        self.parent_story_id: str = ''
        self.parent_story_obj: 'StoryData' = None
        self.applied_object_style: str = ''
        self.auto_sizing_type: str = ''
        self.auto_sizing_reference_point: str = ''
        self.use_no_line_breaks: str = ''
        self.is_auto_size: bool = False
        self.text_column_count: int = 0
        self.linked_text_frame: bool = False
        self.text_wrap_mode: str = ''
        self._from_xml_element(frame_element)

    # ---------------- Private Setters------------------
    def _from_xml_element(self, frame_element: Element):
        self.frame_id = frame_element.get("Self")
        previous_text_frame = frame_element.get("PreviousTextFrame")
        next_text_frame = frame_element.get("NextTextFrame")

        if previous_text_frame != 'n' or next_text_frame != 'n':
            self.linked_text_frame = True

        self.parent_story_id = frame_element.get("ParentStory")
        self.applied_object_style = frame_element.get("AppliedObjectStyle")

        text_frame_pref = frame_element.find("TextFramePreference")
        self.auto_sizing_type = text_frame_pref.get(
            "AutoSizingType") if text_frame_pref is not None else None

        if self.auto_sizing_type and self.auto_sizing_type != 'Off':
            self.is_auto_size = True

        self.auto_sizing_reference_point = text_frame_pref.get(
            "AutoSizingReferencePoint") if text_frame_pref is not None else None
        self.use_no_line_breaks = text_frame_pref.get(
            "UseNoLineBreaksForAutoSizing") if text_frame_pref is not None else None
        self.text_column_count = text_frame_pref.get(
            "TextColumnCount") if text_frame_pref is not None else None

        text_wrap_pref = frame_element.find("TextWrapPreference")
        self.text_wrap_mode = text_wrap_pref.get(
            "TextWrapMode") if text_wrap_pref is not None else None

    # ---------------- External Setters------------------
    def add_parent_story_obj(self, story: 'StoryData'):
        self.parent_story_obj = story

    # ----------------Getters------------------
    def get_parent_story_obj(self) -> 'StoryData':
        return self.parent_story_obj

    def get_auto_sizing_type(self) -> str:
        return self.auto_sizing_type

    def get_use_no_line_breaks(self) -> str:
        return self.use_no_line_breaks

    def get_auto_sizing_reference_point(self) -> str:
        return self.auto_sizing_reference_point

    def get_is_auto_size(self) -> bool:
        return self.is_auto_size

    def get_text_column_count(self) -> int:
        return self.text_column_count

    def get_is_linked_text_frame(self) -> bool:
        return self.linked_text_frame

    def get_applied_object_style(self):
        return self.applied_object_style

    def get_text_wrap_mode(self) -> str:
        return self.text_wrap_mode

    def get_frame_id(self) -> str:
        return self.frame_id

    # ----------------String Method------------------
    def __str__(self):
        return f"TextFrame ID: {self.frame_id}\n" + \
               f"Parent Story: {self.parent_story_id}\n" + \
               f"Applied Object Style: {self.applied_object_style or 'None'}\n" + \
               f"Is Auto Size: {self.is_auto_size}" + \
               f"Auto Sizing Type: {self.auto_sizing_type or 'None'}\n" + \
               f"Auto Sizing Reference Point: {self.auto_sizing_reference_point or 'None'}\n" + \
               f"Use No Line Breaks: {self.use_no_line_breaks or 'None'}\n"
