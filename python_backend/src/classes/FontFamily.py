from typing import List

# **********************************************************
# Class: Font
# Init Locations: FontsParser, SourceFolderParser
# Methods calls from:
# Method calls to:
# Description: FontsParser inits this object. Stores data related
# to a specific fontFamily including fonts.
# **********************************************************


class FontFamily:
    def __init__(self):
        self.font_family: str = ''
        self.font_type: str = ''
        self.fonts: List[str] = []
        self.variable_font: bool = False

    # ----------------Getters------------------

    def get_font_family(self) -> str:
        return self.font_family

    def get_font_type(self) -> str:
        return self.font_type

    def is_variable_font(self) -> bool:
        return self.variable_font

    # ----------------String Method------------------
    def __str__(self):
        return f"Font Family: {self.font_family}, Font Type: {self.font_type}, Fonts: {', '.join(self.fonts)}, Variable Font: {self.variable_font}"
