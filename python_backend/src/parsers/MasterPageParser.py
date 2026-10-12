import logging
import os
from lxml import etree as ET
from xml.etree.ElementTree import Element
from typing import List, Optional
from src.classes.Link import Link

logger = logging.getLogger(__name__)


# **********************************************************
# Class: MasterPageParser
# Init Locations: FrontifyChecker
# Methods calls from:
# Method calls to:
# Description: Parses master page XML.
# **********************************************************
class MasterPageParser:
    def __init__(self, masterspreads_dir: Optional[str]):
        """masterspreads_dir is None when the IDML has no master spreads (valid: the [None] master only)."""
        self.unexpected_elements: List[str] = []
        self.links_obj_list: List[Link] = []
        if masterspreads_dir:
            self._get_elements_from_all_files(masterspreads_dir)

    # ---------------- Private Setters------------------
    def _get_elements_from_file(self, file_path: str) -> List[str]:
        tree = ET.parse(file_path)
        root = tree.getroot()
        master_spread = root.find('MasterSpread')
        elements: List[str] = []
        if master_spread is not None:
            self.links_obj_list.extend(self._extract_links_data(root))
            for child in master_spread:
                if child.tag not in ['Properties', 'Page']:
                    self.unexpected_elements.append(child.tag)
                elements.append(child.tag)
        return elements

    def _get_elements_from_all_files(self, master_spreads_dir: str):
        for file_name in sorted(os.listdir(master_spreads_dir)):
            if file_name.endswith('.xml'):
                file_path = os.path.join(master_spreads_dir, file_name)
                self._get_elements_from_file(
                    file_path)

    def _extract_links_data(self, root: Element) -> List[Link]:
        links_obj_list: List[Link] = []
        for link_element in root.findall(".//Link"):
            try:
                links_obj_list.append(Link(link_element))
            except Exception:
                logger.warning('Skipping unreadable master-page link %s', link_element.get('Self'), exc_info=True)

        return links_obj_list

    # ----------------Getters------------------
    def has_unexpected_elements(self) -> bool:
        """Returns true if there master page is used"""
        return bool(self.unexpected_elements)

    def get_unexpected_elements(self) -> List:
        return self.unexpected_elements

    def get_links_objs(self) -> List[Link]:
        return self.links_obj_list
