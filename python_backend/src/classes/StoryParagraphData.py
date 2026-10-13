from xml.etree.ElementTree import Element
from typing import Dict, List
from src.classes.PropertyBase import PropertyBase


class StoryParagraphData:
    """A class to represent and manage paragraph styles."""
    def __init__(self, index, par_style_range: Element, styles_parser: 'StylesParser', fonts_parser: 'FontsParser'):
        self.style_id: str = ''
        self.normalized_style_id: str = ''
        self.index = index
        self.all_properties: Dict[str, str] = {}
        self.overrides: Dict[str, str] = {}
        self.styles_parser = styles_parser
        self.child_char_style_objs: List['StoryCharacterData'] = []
        self._extract_paragraph_data(par_style_range, styles_parser)
        # self.based_on: str = self.all_properties.get("BasedOn")
        self.applied_font_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "AppliedFont")
        self.hyphenation_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "Hyphenation")
        self.grid_alignment_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "GridAlignment")
        self.composer_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "Composer")
        self.kerning_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "KerningMethod")
        self.filltint_obj: PropertyBase = PropertyBase(
            self.style_id, styles_parser, "FillTint")
        self.content: str = ''
        self._add_used_paragraph_font(fonts_parser)

    def _extract_paragraph_data(self, par_style_range: Element, styles_parser: 'StylesParser'):
        self.style_id = par_style_range.get(
            "AppliedParagraphStyle")
        self.normalized_style_id = self.normalize_style_id(self.style_id)

        # Get properties of the paragraph style from Styles.xml
        self.all_properties = styles_parser.get_all_properties(
            self.style_id)

        # Extract attribute overrides from par_style_range
        self.overrides = {}
        for attr, value in par_style_range.attrib.items():
            if attr != "AppliedParagraphStyle":
                self.overrides[attr] = value
        # Formatting stored as elements on the range itself (e.g. AppliedFont); not counted as overrides here,
        # only used to resolve a run's effective value.
        properties = par_style_range.find("Properties")
        self.local_properties: Dict[str, str] = (
            {prop.tag: prop.text for prop in properties if isinstance(prop.tag, str)} if properties is not None else {})

    def _add_used_paragraph_font(self, fonts_parser: 'FontsParser'):
        fonts_parser.add_used_font_family(
            self.applied_font_obj.value)
        fonts_parser.add_paragraph_face(
            self.applied_font_obj.value, PropertyBase(self.style_id, self.styles_parser, "FontStyle").value)

    def normalize_style_id(self, style_id):
        # Check if the style ID is valid and not None
        if style_id is None:
            return None

        # Define prefixes to remove
        prefixes = ["ParagraphStyle/$ID/", "ParagraphStyle/"]

        # Remove any known prefix from the style_id
        for prefix in prefixes:
            if style_id.startswith(prefix):
                return style_id[len(prefix):]

        return style_id

    def append_content(self, content: str):
        self.content += content

    def add_child_char_style(self, char_style: 'StoryCharacterData'):
        char_style.paragraph = self
        self.child_char_style_objs.append(char_style)
        self.append_content(char_style.get_content())

    def find_property(self, key: str) -> str:
        return self.all_properties.get(key, None)

    def has_hyphenation(self) -> bool:
        return self.hyphenation_obj.value == "true"

    def get_content(self) -> str:
        return self.content

    def get_grid_alignment(self) -> str:
        return self.grid_alignment_obj.value

    def get_composer(self) -> str:
        return self.composer_obj.value
    
    def get_filltint(self) -> str:
        return self.filltint_obj.value

    def has_overrides(self) -> bool:
        return bool(self.overrides)


    

    def __str__(self):
        return f"Style ID: {self.style_id}\n" + \
            str(self.applied_font_obj) + "\n" + \
            str(self.hyphenation_obj) + "\n" + \
            "\n".join(f"{key}: {value}" for key, value in self.all_properties.items()
                      if key not in ["AppliedFont", "BasedOn", "Hyphenation"])
