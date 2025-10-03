from typing import Dict
from lxml import etree as ET


# **********************************************************
# Class: StylesParser
# Init Locations: FrontifyChecker
# Methods calls from: StoryParagraphData, PropertyBase
# Method calls to:
# Description: A parser class to extract paragraph styles from the provided XML path.
# **********************************************************
class StylesParser:
    def __init__(self, xml_path: str):
        self.paragraph_styles: Dict[str, Dict[str, str]] = self._extract_paragraph_styles(
            xml_path)
        self.character_styles: Dict[str, Dict[str, str]] = self._extract_character_styles(
            xml_path)

    # ---------------- Private Setters------------------
    def _extract_paragraph_styles(self, xml_path: str) -> Dict[str, Dict[str, str]]:
        styles: Dict[str, Dict[str, str]] = {}
        tree = ET.parse(xml_path)
        root = tree.getroot()
        for par_style in root.findall(".//ParagraphStyle"):
            style_id = par_style.get("Self")
            properties = par_style.find("Properties")
            style_properties = {}
            if properties is not None:
                for prop in properties:
                    style_properties[prop.tag] = prop.text
            style_properties["Hyphenation"] = par_style.get("Hyphenation")
            style_properties["FillTint"] = par_style.get("FillTint")
            style_properties["GridAlignment"] = par_style.get("GridAlignment")
            style_properties["Composer"] = par_style.get("Composer")
            style_properties["KerningMethod"] = par_style.get("KerningMethod")
            styles[style_id] = style_properties
        return styles

    def _extract_character_styles(self, xml_path: str) -> Dict[str, Dict[str, str]]:
        styles: Dict[str, Dict[str, str]] = {}
        tree = ET.parse(xml_path)
        root = tree.getroot()
        for char_style in root.findall(".//CharacterStyle"):
            style_id = char_style.get("Self")
            properties = char_style.find("Properties")
            style_properties = {}
            if properties is not None:
                for prop in properties:
                    style_properties[prop.tag] = prop.text
            style_properties["KerningMethod"] = char_style.get("KerningMethod")
            styles[style_id] = style_properties
        return styles

    # ----------------Getters------------------
    def get_all_properties(self, style_id: str) -> Dict[str, str]:
        return self.paragraph_styles.get(style_id, {})

    def get_all_char_properties(self, style_id: str) -> Dict[str, str]:
        return self.character_styles.get(style_id, {})

    def find_char_property(self, key: str):
        return self.character_styles.get(key, None)

    # ----------------Debug Prints------------------
    def print_par_style_names(self):
        for style_name in self.paragraph_styles.keys():
            print(style_name)
