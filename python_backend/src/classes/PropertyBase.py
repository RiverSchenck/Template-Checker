# **********************************************************
# Class: PropertyBase
# Init Locations: ParagraphStyle
# Methods calls from: ParagraphStyle
# Method calls to: StyleParser
# Description: Finds a properties actual value if inherited.
# **********************************************************
class PropertyBase:
    def __init__(self, style_id: str, styles_parser: 'StylesParser', property_name: str):
        self.style_id = style_id
        self.inherited_from: str = ''
        self.property_name = property_name
        self.value: str = self._resolve_inheritance(style_id, styles_parser)

    # ---------------- Private Setters------------------
    def _resolve_inheritance(self, style_id: str, styles_parser: 'StylesParser') -> str:
        if "ParagraphStyle" in style_id:
            return self._par_resolve_inheritance(style_id, styles_parser)
        if "CharacterStyle" in style_id:
            return self._char_resolve_inheritance(style_id, styles_parser)
        print(f"PropertyBase: Unexpected style type for {style_id}")
        return ''

    def _normalize_value(self, value: str) -> str:
        if value and value.startswith("$ID/"):
            return value.replace("$ID/", "")

        return value

    def _par_resolve_inheritance(self, style_id: str, styles_parser: 'StylesParser') -> str:
        inherited_value = styles_parser.get_all_properties(
            style_id).get(self.property_name)
        inherited_value = self._normalize_value(inherited_value)

        if not inherited_value:
            base_style = styles_parser.get_all_properties(
                style_id).get("BasedOn")
            if base_style:
                # Normalize the style_id
                if base_style.startswith("$ID/"):
                    base_style = "ParagraphStyle/" + base_style
                self.inherited_from = base_style
                return self._par_resolve_inheritance(base_style, styles_parser)
        return inherited_value

    def _char_resolve_inheritance(self, style_id: str, styles_parser: 'StylesParser') -> str:
        inherited_value = styles_parser.get_all_char_properties(
            style_id).get(self.property_name)
        inherited_value = self._normalize_value(inherited_value)

        if not inherited_value:
            base_style = styles_parser.get_all_char_properties(
                style_id).get("BasedOn")
            if base_style:
                # Normalize the style_id
                if base_style.startswith("$ID/"):
                    base_style = "CharacterStyle/" + base_style
                self.inherited_from = base_style
                return self._char_resolve_inheritance(base_style, styles_parser)
        return inherited_value

    # ----------------Getters------------------
    def get_property_value(self) -> str:
        return self.value

    def get_inherited_from_value(self) -> str:
        return self.inherited_from

    # ----------------String Method------------------
    def __str__(self) -> str:
        if self.inherited_from:
            return f"{self.property_name}: {self.value} (Inherited from: {self.inherited_from})"
        else:
            return f"{self.property_name}: {self.value} (Set directly)"
