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
        return self._follow_based_on(style_id, 'ParagraphStyle', styles_parser.get_all_properties)

    def _char_resolve_inheritance(self, style_id: str, styles_parser: 'StylesParser') -> str:
        return self._follow_based_on(style_id, 'CharacterStyle', styles_parser.get_all_char_properties)

    def _follow_based_on(self, style_id: str, kind: str, properties_of) -> str:
        """Walk the BasedOn chain until a style sets the property. inherited_from ends up as the last style
        visited (the one the value came from). A cyclic chain stops instead of recursing forever."""
        visited = set()
        while style_id not in visited:
            visited.add(style_id)
            properties = properties_of(style_id)
            value = self._normalize_value(properties.get(self.property_name))
            if value:
                return value
            base_style = properties.get("BasedOn")
            if not base_style:
                return value
            if base_style.startswith("$ID/"):
                base_style = f"{kind}/{base_style}"
            self.inherited_from = base_style
            style_id = base_style
        return None

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
