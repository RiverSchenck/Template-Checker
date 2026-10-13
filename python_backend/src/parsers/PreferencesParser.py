from src.helpers import safe_xml
from typing import Dict


class PreferencesParser:
    """A parser class to extract document preferences."""
    def __init__(self, xml_path: str):
        self.document_bleed: Dict[str,
                                  str] = self._extract_document_bleed(xml_path)

    def _extract_document_bleed(self, xml_path: str):
        tree = safe_xml.parse(xml_path)
        root = tree.getroot()
        # Find the DocumentPreference element
        document_preference = root.find(".//DocumentPreference")
        if document_preference is not None:
            # Extract bleed values
            bleed_values = {
                'top': document_preference.get("DocumentBleedTopOffset"),
                'bottom': document_preference.get("DocumentBleedBottomOffset"),
                'inside': document_preference.get("DocumentBleedInsideOrLeftOffset"),
                'outside': document_preference.get("DocumentBleedOutsideOrRightOffset"),
            }
            return bleed_values
        else:
            return None
