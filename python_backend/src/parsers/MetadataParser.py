from lxml import etree as ET
import os
import base64
from typing import List
from src.classes.Preview import Preview


# **********************************************************
# Class: MetadataParser
# Init Locations: FrontifyGUI
# Methods calls from:
# Method calls to:
# Description: Parsers XML metadata for preview image data.
# **********************************************************
class MetadataParser:
    def __init__(self, xml_path: str, data_folder: str):
        self.previews_objs_list: List[Preview] = self._parse(
            data_folder, xml_path)

    # ---------------- Private Setters------------------
    def _parse(self, data_folder: str, xml_path: str):
        previews = []
        with open(xml_path, 'r') as file:
            tree = ET.parse(file)
            root = tree.getroot()

            # Locate the `<xmp:PageInfo>` node
            page_info_node = root.find(
                ".//xmp:PageInfo", namespaces={"xmp": "http://ns.adobe.com/xap/1.0/"})
            if page_info_node is not None:
                # Now locate the `<rdf:li>` nodes within the `<xmp:PageInfo>` node
                page_nodes = page_info_node.findall(
                    ".//rdf:li", namespaces={"rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"})
                for page_node in page_nodes:
                    page_number_element = page_node.find("xmpTPg:PageNumber", namespaces={
                                                         "xmpTPg": "http://ns.adobe.com/xap/1.0/t/pg/"})
                    image_data_element = page_node.find("xmpGImg:image", namespaces={
                                                        "xmpGImg": "http://ns.adobe.com/xap/1.0/g/img/"})
                    # Extract width and height
                    width_element = page_node.find("xmpGImg:width", namespaces={
                        "xmpGImg": "http://ns.adobe.com/xap/1.0/g/img/"})
                    height_element = page_node.find("xmpGImg:height", namespaces={
                        "xmpGImg": "http://ns.adobe.com/xap/1.0/g/img/"})
                    width = width_element.text if width_element is not None else None
                    height = height_element.text if height_element is not None else None

                    # Check if these elements are not None before extracting the text
                    if page_number_element is not None and image_data_element is not None:
                        page_number = page_number_element.text
                        image_data = image_data_element.text
                        image_data_b64 = image_data
                        image_data_b64 = image_data_b64.replace("&#xA;", "\n")
                        decoded_image_data = base64.b64decode(image_data_b64)
                        previews_folder = os.path.join(
                            data_folder, 'Previews')
                        if decoded_image_data:
                            if not os.path.exists(previews_folder):
                                os.makedirs(previews_folder)
                            image_name = f"{page_number}.jpg"
                            image_file_path = os.path.join(
                                previews_folder, image_name)
                            with open(image_file_path, 'wb') as image_file:
                                image_file.write(decoded_image_data)
                        preview = Preview(
                            image_name, image_file_path, page_number, width, height, image_data_b64)
                        previews.append(preview)
        return previews

    # ----------------Getters------------------
    def get_all_image_paths(self):
        images = []
        for preview in self.previews_objs_list:
            images.append(preview.get_image_path())
        return images

    def get_all_base_64(self):
        base_64_arr = []
        for preview in self.previews_objs_list:
            base_64_arr.append(preview.get_base_64())
        return base_64_arr

    def get_preview_by_page(self, page_number):
        for preview in self.previews_objs_list:
            if preview.page == page_number:
                return preview
        return None

    # ----------------Debug Prints------------------
    def print_all_previews(self):
        for preview in self.previews_objs_list:
            print(preview)
