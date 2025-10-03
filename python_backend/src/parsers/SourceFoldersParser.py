import os
from typing import List
from fontTools.ttLib import TTFont, TTCollection
from src.classes.Image import Image
from src.classes.SourceFontFamily import SourceFontFamily


# **********************************************************
# Class: SourceFoldersParser
# Init Locations: FrontifyChecker
# Methods calls from:
# Method calls to:
# Description: A class to parse and manage data from the source package.
# **********************************************************
class SourceFoldersParser:
    def __init__(self, document_links_folder_path: str, document_fonts_folder_path: str):
        self.images_obj_list: List[Image] = self._extract_images_data(
            document_links_folder_path)
        self.document_fonts: List[SourceFontFamily] = self._extract_document_fonts(
            document_fonts_folder_path)

    # ---------------- Private Setters------------------
    def _extract_images_data(self, document_links_folder_path: str):
        images_obj_list = []
        for filename in os.listdir(document_links_folder_path):
            if filename == '.DS_Store':
                continue

            image_path = os.path.join(
                document_links_folder_path, filename)
            image_data = Image(image_path)
            images_obj_list.append(image_data)
        return images_obj_list

    def _extract_document_fonts(self, document_fonts_folder_path: str):
        document_fonts: List[SourceFontFamily] = []

        for file_name in os.listdir(document_fonts_folder_path):

            if file_name.endswith('.lst') or file_name == '.DS_Store':
                continue

            font_family_obj = SourceFontFamily(
                file_name, document_fonts_folder_path)
            document_fonts.append(font_family_obj)
        return document_fonts

    # ----------------Getters------------------
    def get_document_fonts(self):
        return self.document_fonts

    def get_images_obj_list(self):
        return self.images_obj_list

    # ----------------Debug Prints------------------
    def print_images_obj_list(self):
        for image_data in self.images_obj_list:
            print(image_data)

    def print_document_fonts(self):
        print("\n".join(font.fontFamily for font in self.document_fonts))
