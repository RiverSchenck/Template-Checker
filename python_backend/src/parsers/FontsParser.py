from lxml import etree as ET
from typing import List
import os
from src.classes.UsedFontFamily import UsedFontFamily


# **********************************************************
# Class: FontsParser
# Init Locations: FrontifyChecker
# Methods calls from: StoryCharacterData, FontsParser
# Method calls to:
# Description: Parses Fonts.XML for fonts in the
# **********************************************************
class FontsParser:
    def __init__(self, fonts_xml_path: str):
        self.font_families_from_xml: List[str] = self._extract_fonts(
            fonts_xml_path)
        self.used_font_families: List[UsedFontFamily] = []

    # ---------------- Private Setters------------------
    def _extract_fonts(self, fonts_xml_path: str) -> List[UsedFontFamily]:
        if not os.path.exists(fonts_xml_path):
            raise FileNotFoundError(f"{fonts_xml_path} does not exist")

        tree = ET.parse(fonts_xml_path)
        root = tree.getroot()

        fonts_families_list: List[UsedFontFamily] = []
        font_family_elements = root.findall(".//FontFamily")
        for font_family_element in font_family_elements:
            font_family_obj = UsedFontFamily(font_family_element)
            fonts_families_list.append(font_family_obj)
        return fonts_families_list

    # ---------------- External Setters------------------
    def add_used_font_family(self, font_family_name: str):
        """Add a font family object to the list of used font families."""
        # Search for the font object in self.font_families_from_xml
        matching_font_obj = next(
            (font for font in self.font_families_from_xml
                if font.get_font_family() == font_family_name), None)

        # If found and not already in the list, add to self.used_font_families
        if matching_font_obj and matching_font_obj not in self.used_font_families:
            self.used_font_families.append(matching_font_obj)

    # ----------------Getters------------------
    def get_fonts_families_from_xml(self) -> List[UsedFontFamily]:
        """Returns font_families from_xml list"""
        return self.font_families_from_xml

    def get_used_font_families(self) -> List[str]:
        """Retrieve the list of used font families."""
        return self.used_font_families

    def get_used_font_families_count(self):
        return len(self.used_font_families)

    # ----------------Debug Prints------------------
    def print_used_font_families(self):
        print("\n".join(str(font_family)
              for font_family in self.used_font_families))

    def print_font_families_from_xml(self):
        print("\n".join(str(font) for font in self.font_families_from_xml))
