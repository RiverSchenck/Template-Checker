class Preview:
    """Extracts first 2 pages preview images."""
    def __init__(self, image_title: str, image_location: str, page: str, width: str, height: str, base_64: str):
        self.image_title = image_title
        self.image_location = image_location
        self.page = page
        self.width = width
        self.height = height
        self.base_64 = base_64

    def __str__(self):
        return (f"Preview Object:\n"
                f"Image Title: {self.image_title}\n"
                f"Image Location: {self.image_location}\n"
                f"Page: {self.page}\n"
                f"Width: {self.width}\n"
                f"Height: {self.height}\n")
