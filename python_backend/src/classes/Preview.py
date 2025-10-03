from PIL import Image, ImageTk, ImageDraw
import tkinter as tk


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

    def display_preview_for_page(self):
        # Create a new pop-up window
        top = tk.Toplevel()
        top.title(f"Preview for Page {self.page}")

        # Adjust the window size to fit the image
        top.geometry(f"{self.width}x{self.height}")

        # Load the image and display it on a Canvas
        image = Image.open(self.get_image_path())
        photo = ImageTk.PhotoImage(image)
        canvas = tk.Canvas(top, width=self.width, height=self.height)
        canvas.create_image(0, 0, anchor=tk.NW, image=photo)

        # # Draw a rectangle callout on the canvas
        # # Here we're hardcoding it's coordinates (x1, y1, x2, y2)
        # # Replace these values with the actual coordinates of the image region you wish to highlight
        # x1, y1 = 86, 64
        # x2, y2 = 300, 250
        # canvas.create_rectangle(x1, y1, x2, y2, outline="red", width=3)

        canvas.pack()

        top.mainloop()

    # ----------------String Method------------------
    def __str__(self):
        return (f"Preview Object:\n"
                f"Image Title: {self.image_title}\n"
                f"Image Location: {self.image_location}\n"
                f"Page: {self.page}\n"
                f"Width: {self.width}\n"
                f"Height: {self.height}\n")
