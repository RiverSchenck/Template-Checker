from typing import List
import os
from lxml import etree as ET
from src.classes.FontFamily import FontFamily
from fontTools.ttLib import TTFont

# **********************************************************
# Class: Font
# Init Locations: FontsParser, SourceFolderParser
# Methods calls from:
# Method calls to:
# Description: FontsParser inits this object. Stores data related
# to a specific fontFamily including fonts.
# **********************************************************


class SourceFontFamily(FontFamily):
    def __init__(self, file_name: str, document_links_folder_path: str):
        super().__init__()
        self.font_error: bool = False
        self.extension: str = ''
        self._extract_fonts(file_name, document_links_folder_path)

    # ---------------- Private Setters------------------
    def _extract_fonts(self, file_name: str, document_links_folder_path: str):
        self.extension = os.path.splitext(file_name)[1].lower()

        font_path = os.path.join(document_links_folder_path, file_name)

        try:
            font = TTFont(font_path)
            self._process_font(font, file_name)

        except Exception as e:
            self._set_font_with_error(file_name, e)

    def _process_font(self, font: TTFont, file_name: str):
        """Process a single font and add to the document fonts list.
        How InDesign declares Font Family name:
        nameID 1: Font Family Name (e.g., Barlow)
        nameID 2: Font Subfamily Name (e.g., Condensed, Bold, Italic)
        nameID 16: Typographic Family Name (e.g., Barlow Condensed) 
            — this overrides nameID 1 if present and is used for fonts that are part of a superfamily.
        nameID 17: Typographic Subfamily Name (e.g., Regular, Bold) 
            — this overrides nameID 2 when nameID 16 is present.
        Last Fallback: debug name"""
        try:
            typographic_family_name = None
            family_name = None
            # Not used but keeping logic in case needs debugging in future
            typographic_subfamily_name = None
            subfamily_name = None  # Not used but keeping logic in case needs debugging in future

            # Extract the typographic family and subfamily names if they exist
            for record in font['name'].names:
                if record.nameID == 16 and record.platformID == 3 and record.langID == 0x0409:
                    typographic_family_name = str(record.string, 'utf-16-be')
                elif record.nameID == 17 and record.platformID == 3 and record.langID == 0x0409:
                    typographic_subfamily_name = str(
                        record.string, 'utf-16-be')

            # Extract the standard family and subfamily names if the typographic ones do not exist
            if not typographic_family_name:
                for record in font['name'].names:
                    if record.nameID == 1 and record.platformID == 3 and record.langID == 0x0409:
                        family_name = str(record.string, 'utf-16-be')
                    elif record.nameID == 2 and record.platformID == 3 and record.langID == 0x0409:
                        subfamily_name = str(record.string, 'utf-16-be')

            # Use the typographic names if available, otherwise fall back to standard names
            final_family_name = typographic_family_name if typographic_family_name else family_name
            # final_subfamily_name = typographic_subfamily_name if typographic_subfamily_name else subfamily_name

            # Final check if still none, fall back to debug name
            if not final_family_name:
                final_family_name = font["name"].getDebugName(1)

            styles = []
            # Now collect all the styles
            for record in font['name'].names:
                if record.nameID == 2 and record.platformID == 3 and record.langID == 0x0409:
                    style_name = str(record.string, 'utf-16-be')
                    styles.append(style_name)

            self.font_family = final_family_name
            self.fonts = [styles]
            self.font_type = "TrueType" if font.sfntVersion == "true" else "Other"
            self.variable_font = "fvar" in font
        except Exception as e:
            self._set_font_with_error(file_name, e)

    def _set_font_with_error(self, file_name: str, e: Exception = Exception("FILE TYPE ERROR")):
        self.font_family = file_name
        self.font_type = "UNSUPPORTED FONT"
        self.variable_font = False
        self.set_font_error()
        print(f"Error processing font: {e} file: {file_name}")

    # ---------------- External Setters------------------
    def set_font_error(self):
        self.font_error = True

    # ----------------Getters------------------
    def get_font_error(self) -> bool:
        return self.font_error

    def get_extension(self) -> str:
        return self.extension
