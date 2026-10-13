from typing import Dict, Optional, Tuple
from xml.etree.ElementTree import Element
from src.classes.PropertyBase import PropertyBase

# What InDesign uses when nothing in the chain sets a value.
NO_CHARACTER_STYLE = "CharacterStyle/$ID/[No character style]"


class StoryCharacterData:
    """One CharacterStyleRange in a story: its character style, text, font and overrides. Stored on the
    paragraph (StoryParagraphData) it belongs to."""
    def __init__(self, char_style_range: Element, fonts_parser: 'FontsParser', styles_parser: 'StylesParser'):
        self.style_id: str = ''
        self.normalized_style_id: str = ''
        self.content: str = ''
        self.applied_font: str = ''
        self.all_properties: Dict[str, str] = {}
        # Any attributes besides "AppliedCharacterStyle" and any properties
        self.overrides: Dict[str, str] = {}
        self.table_used: bool = False
        self.styles_parser = styles_parser
        self.paragraph: Optional['StoryParagraphData'] = None  # set when added to its paragraph
        self._extract_character_data(char_style_range)
        self._add_used_character_font(fonts_parser)
        self.kerning_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "KerningMethod")

    def _extract_character_data(self, char_style_range: Element):
        self.style_id = char_style_range.get(
            "AppliedCharacterStyle")
        self.normalized_style_id = self.normalize_style_id(self.style_id)
        content = ""

        for content_element in char_style_range.findall("Content"):
            content_text = content_element.text if content_element.text is not None else ""
            content += content_text
        self.content = content

        applied_font_element = char_style_range.find(
            "Properties/AppliedFont")
        self.applied_font = applied_font_element.text if applied_font_element is not None else None
        # Extracting attribute overrides
        for attr, value in char_style_range.attrib.items():
            if attr != "AppliedCharacterStyle":
                self.overrides[attr] = value
            # Extracting child element overrides under Properties
            properties_element = char_style_range.find(
                "Properties")
            if properties_element is not None:
                for prop_child in properties_element:
                    self.overrides[prop_child.tag] = prop_child.text
        table_element = char_style_range.find("Table")
        if table_element is not None:
            self.add_table()

    def _add_used_character_font(self, fonts_parser: 'FontsParser'):
        if self.applied_font is not None:
            fonts_parser.add_used_font_family(
                self.applied_font)

    def normalize_style_id(self, style_id):
        # Check if the style ID is valid and not None
        if style_id is None:
            return None

        # Define prefixes to remove
        prefixes = ["CharacterStyle/$ID/", "CharacterStyle/"]

        # Remove any known prefix from the style_id
        for prefix in prefixes:
            if style_id.startswith(prefix):
                return style_id[len(prefix):]

        return style_id

    def effective(self, attr: str) -> Tuple[Optional[str], str]:
        """The value InDesign applies to this run's text, and where it comes from, in InDesign's order: set on
        the text itself, its character style (through BasedOn), the paragraph range, the paragraph style
        (through BasedOn). The source is '' for the text itself, else the style id the value was found in.
        (None, '') when nothing sets it. '$ID/' prefixes are removed from the value."""
        local = self.overrides.get(attr)
        if local:
            return _normalize(local), ''
        if self.style_id and self.style_id != NO_CHARACTER_STYLE:
            prop = PropertyBase(self.style_id, self.styles_parser, attr)
            if prop.value:
                return prop.value, prop.inherited_from or self.style_id
        paragraph = self.paragraph
        if paragraph is None:
            return None, ''
        local = paragraph.overrides.get(attr) or paragraph.local_properties.get(attr)
        if local:
            return _normalize(local), ''
        if paragraph.style_id:
            prop = PropertyBase(paragraph.style_id, paragraph.styles_parser, attr)
            if prop.value:
                return prop.value, prop.inherited_from or paragraph.style_id
        return None, ''

    def add_table(self):
        self.table_used = True

    def has_overrides(self) -> bool:
        return bool(self.overrides)

    def find_override(self, key: str):
        return self.overrides.get(key, None)

    def get_content(self) -> str:
        return self.content

    def has_table(self) -> bool:
        return bool(self.table_used)

    def __str__(self):
        return f"Applied Character Style: {self.style_id}\n" + \
               f"Content: {self.content}\n" + \
               f"Applied Font: {self.applied_font}\n" + \
               (f"Overrides: {self.overrides}\n" if self.has_overrides() else "")


def _normalize(value: str) -> str:
    return value.replace("$ID/", "", 1) if value.startswith("$ID/") else value
