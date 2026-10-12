import os
from typing import List, Tuple
from fontTools.ttLib import TTFont, TTCollection
from src.classes.Image import Image
from src.classes.SourceFontFamily import SourceFontFamily


class SourceFoldersParser:
    """A class to parse and manage data from the source package."""
    def __init__(self, link_files: List[Tuple[str, int]], document_fonts_folder_path: str):
        """link_files: (file name, size in bytes) for each file in the package's Links folder."""
        self.images_obj_list: List[Image] = [
            Image(file_name, size_bytes) for file_name, size_bytes in link_files]
        self.document_fonts: List[SourceFontFamily] = self._extract_document_fonts(
            document_fonts_folder_path)

    def _extract_document_fonts(self, document_fonts_folder_path: str):
        document_fonts: List[SourceFontFamily] = []

        for file_name in sorted(os.listdir(document_fonts_folder_path)):

            if file_name.endswith('.lst') or file_name == '.DS_Store':
                continue

            font_family_obj = SourceFontFamily(
                file_name, document_fonts_folder_path)
            document_fonts.append(font_family_obj)
        return document_fonts
