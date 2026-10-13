from lxml import etree as ET
from typing import Dict, List, Set
import os
from src.classes.UsedFontFamily import UsedFontFamily


class FontsParser:
    """Parses Fonts.XML for fonts in the"""
    def __init__(self, fonts_xml_path: str):
        self.font_families_from_xml: List[str] = self._extract_fonts(
            fonts_xml_path)
        self.used_font_families: List[UsedFontFamily] = []
        # Style names (FontStyle) used with each family, from the text runs.
        self.used_faces: Dict[str, Set[str]] = {}
        # Styles named by paragraph styles, for families no text run uses (e.g. only empty paragraphs).
        self.paragraph_faces: Dict[str, Set[str]] = {}

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

    def add_used_font_family(self, font_family_name: str):
        """Add a font family object to the list of used font families."""
        # Search for the font object in self.font_families_from_xml
        matching_font_obj = next(
            (font for font in self.font_families_from_xml
                if font.font_family == font_family_name), None)

        # If found and not already in the list, add to self.used_font_families
        if matching_font_obj and matching_font_obj not in self.used_font_families:
            self.used_font_families.append(matching_font_obj)

    def add_used_face(self, font_family_name: str, style_name: str):
        """A face used by text: the family is used, and so is this style of it."""
        self.add_used_font_family(font_family_name)
        if font_family_name:
            self.used_faces.setdefault(font_family_name, set()).add(style_name or 'Regular')

    def add_paragraph_face(self, font_family_name: str, style_name: str):
        if font_family_name:
            self.paragraph_faces.setdefault(font_family_name, set()).add(style_name or 'Regular')

    def faces_used_with(self, font_family_name: str) -> Set[str]:
        """Styles of this family the text uses; for a family only paragraph styles name, their styles."""
        return self.used_faces.get(font_family_name) or self.paragraph_faces.get(font_family_name, set())

    def get_used_font_families_count(self):
        return len(self.used_font_families)
