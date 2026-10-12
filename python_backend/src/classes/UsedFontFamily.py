from typing import List
from xml.etree.ElementTree import Element
from src.classes.FontFamily import FontFamily


class UsedFontFamily(FontFamily):
    """FontsParser inits this object. Stores data related to a specific fontFamily including fonts."""
    def __init__(self, font_family_element: Element):
        super().__init__()
        self._extract_fonts(font_family_element)

    def _extract_fonts(self, font_family_element: Element):
        # For each FontFamily, find its nested Font tags
        self.font_family = font_family_element.get('Name')
        self.fonts = []
        self.variable_font = False
        font_elements = font_family_element.findall(".//Font")
        for font_element in font_elements:
            name = font_element.get('Name')
            font_type = font_element.get('FontType')
            self.fonts.append(name)
            unique_variable_font = font_element.get('NumDesignAxes')
            if unique_variable_font is not None:
                self.variable_font = True

        self.font_type = font_type
