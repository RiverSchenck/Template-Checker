# **********************************************************
# Class: Preview
# Init Locations: MetadataParser
# Methods calls from:
# Method calls to:
# Description: Extracts first 2 pages preview images.
# **********************************************************
class Preview:
    def __init__(self, image_title: str, image_location: str, page: str, width: str, height: str, base_64: str):
        self.image_title = image_title
        self.image_location = image_location
        self.page = page
        self.width = width
        self.height = height
        self.base_64 = base_64

    # ----------------Getters------------------
    def get_image_path(self) -> str:
        return self.image_location

    def get_base_64(self) -> str:
        return self.base_64

    def get_width(self) -> str:
        return self.width

    def get_height(self) -> str:
        return self.height

    # ----------------String Method------------------
    def __str__(self):
        return (f"Preview Object:\n"
                f"Image Title: {self.image_title}\n"
                f"Image Location: {self.image_location}\n"
                f"Page: {self.page}\n"
                f"Width: {self.width}\n"
                f"Height: {self.height}\n")
