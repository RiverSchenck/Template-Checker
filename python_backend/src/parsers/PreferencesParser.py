from lxml import etree as ET
from typing import Dict


# **********************************************************
# Class: PreferencesParser
# Init Locations: FrontifyChecker
# Methods calls from:
# Method calls to:
# Description: A parser class to extract document preferences.
# **********************************************************
class PreferencesParser:
    def __init__(self, xml_path: str):
        self.document_bleed: Dict[str,
                                  str] = self._extract_document_bleed(xml_path)

    # ---------------- Private Setters------------------
    def _extract_document_bleed(self, xml_path: str):
        tree = ET.parse(xml_path)
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

    # ----------------Getters------------------
    def get_document_bleed(self):
        return self.document_bleed
