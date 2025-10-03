from lxml import etree as ET
import os
import base64
from PIL import Image, ImageTk, ImageDraw
import tkinter as tk
from typing import List
import sys
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

    def display_preview_by_page(self, page_number):
        preview = self.get_preview_by_page(page_number)
        preview.display_preview_for_page()
        return

    def display_all_previews(self):
        if not self.previews_objs_list[0]:
            return
        width = self.previews_objs_list[0].get_width()
        height = self.previews_objs_list[0].get_height()
        # Create a new window
        top = tk.Toplevel()
        top.title("Image Previews")
        top.geometry(f"{width}x{height}")

        # Create a canvas for the images and a scrollbar
        canvas = tk.Canvas(top)
        scrollbar = tk.Scrollbar(top, command=canvas.yview)
        canvas.config(yscrollcommand=scrollbar.set)

        # Frame to hold the images
        frame = tk.Frame(canvas)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        # anchor set to 'n' for centering
        canvas.create_window((0, 0), window=frame, anchor='n')

        # Add each image to the frame
        for preview in self.previews_objs_list:
            # Assuming the Preview object has a method to return an Image object
            image = Image.open(preview.get_image_path())
            photo = ImageTk.PhotoImage(image)
            label = tk.Label(frame, image=photo)
            label.photo = photo  # keep a reference
            # center the images with anchor
            label.pack(pady=10, anchor='center')

        # Update the scroll region after UI has been set up
        frame.bind('<Configure>', lambda e: canvas.configure(
            scrollregion=canvas.bbox('all')))

        def _on_mousewheel(event):
            if sys.platform == "win32":
                canvas.yview_scroll(-1 * (event.delta // 120), "units")
            elif sys.platform == "darwin":  # macOS
                if event.num == 4:
                    canvas.yview_scroll(1, "units")
                elif event.num == 5:
                    canvas.yview_scroll(-1, "units")
            else:
                if event.num == 4:
                    canvas.yview_scroll(-1, "units")
                elif event.num == 5:
                    canvas.yview_scroll(1, "units")

        # Bind the scrolling event to the top Toplevel window.
        top.bind("<MouseWheel>", _on_mousewheel)  # For Windows
        top.bind("<Button-4>", _on_mousewheel)    # For Linux/MacOS
        top.bind("<Button-5>", _on_mousewheel)    # For Linux/MacOS

        top.mainloop()

    # ----------------Debug Prints------------------
    def print_all_previews(self):
        for preview in self.previews_objs_list:
            print(preview)
