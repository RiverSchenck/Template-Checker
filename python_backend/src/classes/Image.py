import os


# **********************************************************
# Class: Image
# Init Locations: SourceFolderParser
# Methods calls from:
# Method calls to:
# Description: A class to represent and manage image data.
# **********************************************************
class Image:
    def __init__(self, image_path: str):
        self.image_path = image_path
        self.image_name: str = os.path.basename(image_path)
        self.image_extension: str = os.path.splitext(self.image_name)[1]
        self.image_size_bytes: int = os.path.getsize(image_path)
        self.image_size_MB: int = self._convert_bytes_to_MB()
        self.parent_link_data_id: str = ''
        print(self.image_name)

    # ---------------- Private Setters------------------
    def _convert_bytes_to_MB(self) -> float:
        return round(self.image_size_bytes / (1024 ** 2), 2)

    # ---------------- Public Setters------------------
    def set_parent_link_data_id(self, data_id: str):
        self.parent_link_data_id = data_id
    # ----------------Getters------------------

    def get_image_name(self) -> str:
        return self.image_name

    def get_image_extension(self) -> str:
        return self.image_extension

    def get_image_size(self) -> int:
        return self.image_size_MB
    
    def get_image_byte_size(self) -> int:
        return self.image_size_bytes

    def get_parent_link_data_id(self) -> str:
        return self.parent_link_data_id

    # ----------------String Method------------------
    def __str__(self) -> str:
        return (
            f"Image Path: {self.image_path}\n"
            f"Image Name: {self.image_name}\n"
            f"Image Extension: {self.image_extension}\n"
            f"Image Size (Bytes): {self.image_size_bytes}\n"
            f"Image Size (MB): {self.image_size_MB}\n"
            f"Parent Link Data ID: {self.parent_link_data_id}"
        )
