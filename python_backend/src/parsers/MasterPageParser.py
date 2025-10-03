import os
from lxml import etree as ET
from xml.etree.ElementTree import Element
from typing import List
from src.classes.Link import Link


# **********************************************************
# Class: MasterPageParser
# Init Locations: FrontifyChecker
# Methods calls from:
# Method calls to:
# Description: Parses master page XML.
# **********************************************************
class MasterPageParser:
    def __init__(self, masterspreads_dir: str):
        self.unexpected_elements: List[str] = []
        self.links_obj_list: List[Link] = []
        self._get_elements_from_all_files(masterspreads_dir)

    # ---------------- Private Setters------------------
    def _get_elements_from_file(self, file_path: str) -> List[str]:
        tree = ET.parse(file_path)
        root = tree.getroot()
        master_spread = root.find('MasterSpread')
        elements: List[str] = []
        if master_spread is not None:
            self.links_obj_list = self._extract_links_data(root)
            for child in master_spread:
                if child.tag not in ['Properties', 'Page']:
                    self.unexpected_elements.append(child.tag)
                elements.append(child.tag)
        return elements

    def _get_elements_from_all_files(self, master_spreads_dir: str):
        for file_name in os.listdir(master_spreads_dir):
            if file_name.endswith('.xml'):
                file_path = os.path.join(master_spreads_dir, file_name)
                self._get_elements_from_file(
                    file_path)

    def _extract_links_data(self, root: Element) -> List[Link]:
        links_obj_list: List[Link] = []
        for link_element in root.findall(".//Link"):
            print(link_element)
            image_data = Link(link_element)
            links_obj_list.append(image_data)

        return links_obj_list

    # ----------------Getters------------------
    def has_unexpected_elements(self) -> bool:
        """Returns true if there master page is used"""
        return bool(self.unexpected_elements)

    def get_unexpected_elements(self) -> List:
        return self.unexpected_elements

    def get_links_objs(self) -> List[Link]:
        return self.links_obj_list

    # ----------------Debug Prints------------------
    def print_unexpected_elements(self):
        if self.unexpected_elements:
            print("Unexpected Elements Found:")
            # Using set to remove duplicates
            for element in set(self.unexpected_elements):
                print(f"  - {element}")
        else:
            print("No unexpected elements found.")
