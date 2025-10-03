from xml.etree.ElementTree import Element
from typing import Dict, List
from src.classes.PropertyBase import PropertyBase


# **********************************************************
# Class: StoryParagraphData
# Init Locations: StoriesParser
# Methods calls from: StoryData
# Method calls to: PropertyBase, StylesParser, FontsParser
# Description: A class to represent and manage paragraph styles.
# **********************************************************
class StoryParagraphData:
    def __init__(self, index, par_style_range: Element, styles_parser: 'StylesParser', fonts_parser: 'FontsParser'):
        self.style_id: str = ''
        self.normalized_style_id: str = ''
        self.index = index
        self.all_properties: Dict[str, str] = {}
        self.par_overrides: Dict[str, str] = {}
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

    # ----------------Private Setters------------------
    def _extract_paragraph_data(self, par_style_range: Element, styles_parser: 'StylesParser'):
        self.style_id = par_style_range.get(
            "AppliedParagraphStyle")
        self.normalized_style_id = self.normalize_style_id(self.style_id)

        # Get properties of the paragraph style from Styles.xml
        self.all_properties = styles_parser.get_all_properties(
            self.style_id)

        # Extract attribute overrides from par_style_range
        self.par_overrides = {}
        for attr, value in par_style_range.attrib.items():
            if attr != "AppliedParagraphStyle":
                self.par_overrides[attr] = value

    def _add_used_paragraph_font(self, fonts_parser: 'FontsParser'):
        fonts_parser.add_used_font_family(
            self.applied_font_obj.get_property_value())

    # ---------------- Utility------------------
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
    # ---------------- External Setters------------------

    def add_content(self, content: str):
        self.content = content

    def append_content(self, content: str):
        self.content += content

    def add_child_char_style(self, char_style: 'StoryCharacterData'):
        self.child_char_style_objs.append(char_style)
        self.append_content(char_style.get_content())

    # ----------------Getters------------------
    def get_index(self):
        return self.index

    def find_property(self, key: str) -> str:
        return self.all_properties.get(key, None)

    def get_style_id(self) -> str:
        return self.style_id

    def get_normalized_style_id(self) -> str:
        return self.normalized_style_id

    def get_child_char_styles(self) -> List['StoryCharacterData']:
        return self.child_char_style_objs

    def has_hyphenation(self) -> bool:
        return self.hyphenation_obj.get_property_value() == "true"

    def get_content(self) -> str:
        return self.content

    def get_grid_alignment(self) -> str:
        return self.grid_alignment_obj.get_property_value()

    def get_composer(self) -> str:
        return self.composer_obj.get_property_value()
    
    def get_filltint(self) -> str:
        return self.filltint_obj.get_property_value()

    def get_kerning(self) -> str:
        return self.kerning_obj

    def get_overrides(self) -> Dict[str, str]:
        return self.par_overrides

    def has_overrides(self) -> bool:
        return bool(self.par_overrides)

    def get_hyphenation_obj(self) -> PropertyBase:
        return self.hyphenation_obj

    def get_grid_alignment_obj(self) -> PropertyBase:
        return self.grid_alignment_obj

    def get_composer_obj(self) -> PropertyBase:
        return self.grid_alignment_obj
    
    def get_filltint_obj(self) -> PropertyBase:
        return self.filltint_obj

    # ----------------String Method------------------
    def __str__(self):
        return f"Style ID: {self.style_id}\n" + \
            str(self.applied_font_obj) + "\n" + \
            str(self.hyphenation_obj) + "\n" + \
            "\n".join(f"{key}: {value}" for key, value in self.all_properties.items()
                      if key not in ["AppliedFont", "BasedOn", "Hyphenation"])
