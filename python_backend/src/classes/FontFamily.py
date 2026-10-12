from typing import List


class FontFamily:
    """FontsParser inits this object. Stores data related to a specific fontFamily including fonts."""
    def __init__(self):
        self.font_family: str = ''
        self.font_type: str = ''
        self.fonts: List[str] = []
        self.variable_font: bool = False

    def __str__(self):
        return f"Font Family: {self.font_family}, Font Type: {self.font_type}, Fonts: {', '.join(self.fonts)}, Variable Font: {self.variable_font}"
