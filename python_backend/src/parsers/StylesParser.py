from typing import Dict
from lxml import etree as ET


def _style_attributes(style) -> Dict[str, str]:
    """The style's own formatting attributes (Hyphenation, FillTint, Position, FontStyle, ...), without its
    identity (Self, Name). Attributes the style doesn't set are absent, as they are in Styles.xml."""
    return {name: value for name, value in style.attrib.items() if name not in ('Self', 'Name')}


class StylesParser:
    """A parser class to extract paragraph styles from the provided XML path."""
    def __init__(self, xml_path: str):
        self.paragraph_styles: Dict[str, Dict[str, str]] = self._extract_paragraph_styles(
            xml_path)
        self.character_styles: Dict[str, Dict[str, str]] = self._extract_character_styles(
            xml_path)

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
            style_properties.update(_style_attributes(par_style))
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
            style_properties.update(_style_attributes(char_style))
            styles[style_id] = style_properties
        return styles

    def get_all_properties(self, style_id: str) -> Dict[str, str]:
        return self.paragraph_styles.get(style_id, {})

    def get_all_char_properties(self, style_id: str) -> Dict[str, str]:
        return self.character_styles.get(style_id, {})

    def find_char_property(self, key: str):
        return self.character_styles.get(key, None)
