import os
from src.helpers.file_names import normalize_file_name


class Image:
    """A class to represent and manage image data."""
    def __init__(self, file_name: str, size_bytes: int):
        self.image_name: str = normalize_file_name(file_name)
        self.image_extension: str = os.path.splitext(self.image_name)[1]
        self.image_size_bytes: int = size_bytes
        self.image_size_MB: int = self._convert_bytes_to_MB()
        self.parent_link_data_id: str = ''

    def _convert_bytes_to_MB(self) -> float:
        return round(self.image_size_bytes / (1024 ** 2), 2)


    def get_image_name(self) -> str:
        return self.image_name


    

    def __str__(self) -> str:
        return (
            f"Image Name: {self.image_name}\n"
            f"Image Extension: {self.image_extension}\n"
            f"Image Size (Bytes): {self.image_size_bytes}\n"
            f"Image Size (MB): {self.image_size_MB}\n"
            f"Parent Link Data ID: {self.parent_link_data_id}"
        )
