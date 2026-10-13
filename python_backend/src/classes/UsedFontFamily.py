from typing import Dict, List, Optional
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
        # Each face by its style name (the FontStyle text uses): its PostScript name and Adobe Fonts id.
        self.faces: Dict[str, Dict[str, Optional[str]]] = {}
        font_type = None
        font_elements = font_family_element.findall(".//Font")
        for font_element in font_elements:
            name = font_element.get('Name')
            font_type = font_element.get('FontType')
            self.fonts.append(name)
            unique_variable_font = font_element.get('NumDesignAxes')
            if unique_variable_font is not None:
                self.variable_font = True
            style_name = font_element.get('FontStyleName')
            if style_name:
                self.faces[style_name] = {
                    'postscript': font_element.get('PostScriptName') or None,
                    'typekit': _typekit_id(font_element.get('TypekitID')),
                }

        self.font_type = font_type

    @property
    def is_adobe_font(self) -> bool:
        """An Adobe Fonts (Typekit) family: InDesign doesn't package these and Frontify doesn't load them."""
        return any(face['typekit'] for face in self.faces.values())


def _typekit_id(value: Optional[str]) -> Optional[str]:
    """The Adobe Fonts id, or None. InDesign writes an empty '$ID/' for fonts that aren't Adobe Fonts."""
    if not value or value == '$ID/':
        return None
    return value
