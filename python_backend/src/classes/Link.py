from urllib.parse import unquote
from xml.etree.ElementTree import Element
from typing import Optional, Tuple


# **********************************************************
# Class: Link
# Init Locations: MasterPageParser, SpreadsParser
# Methods calls from: SpreadsParser
# Method calls to:
# Description: A class to represent and manage image data.
# **********************************************************
class Link:
    def __init__(self, link_element: Element):
        self.link_id: str = ''
        self.grandparent_link_id: str = ''
        self.resource_uri: str = ''
        self.stored_state: str = ''
        self.item_transform: str = ''
        self.container_item_transform: str = ''
        self.geometric_bounds: Optional[Tuple[Tuple[float, float],
                                              Tuple[float, float], Tuple[float, float], Tuple[float, float]]] = None
        self.image_object_style: str = ''
        self.container_object_style: str = ''
        self._extract_xml(link_element)
        self.link_name: str = self.get_image_name()
        # self.is_rectangle: bool = self._is_rectangle()

    # ---------------- PrivateSetters------------------
    def _extract_xml(self, link_element: Element):
        resource_uri_quoted = link_element.get("LinkResourceURI")

        # Convert URL(URI) to regular
        self.resource_uri = unquote(resource_uri_quoted)
        self.stored_state = link_element.get("StoredState")
        self.link_id = link_element.get("Self")

        parent_element = link_element.getparent()
        self.image_object_style = parent_element.get("AppliedObjectStyle")
        self.item_transform = parent_element.get("ItemTransform")

        grandparent_element = parent_element.getparent()
        self.container_object_style = grandparent_element.get(
            "AppliedObjectStyle")
        self.container_item_transform = grandparent_element.get(
            "ItemTransform") if grandparent_element is not None else None
        self.grandparent_link_id = grandparent_element.get(
            "Self")

        # # Extract the coordinates from the PathPointType elements of the rectangle
        # path_points = grandparent_element.findall(".//PathPointType")
        # if path_points:
        #     top_left = tuple(
        #         map(float, path_points[0].get("Anchor").split()))
        #     bottom_left = tuple(
        #         map(float, path_points[1].get("Anchor").split()))
        #     bottom_right = tuple(
        #         map(float, path_points[2].get("Anchor").split()))
        #     top_right = tuple(
        #         map(float, path_points[3].get("Anchor").split()))

        #     # Combine coordinates into a single tuple or list for the geometric_bounds
        #     self.geometric_bounds = (top_left, bottom_left,
        #                              bottom_right, top_right)

        # else:
        #     self.geometric_bounds = None

    # def _is_rectangle(self) -> bool:
    #     def dot(p1, p2):
    #         return p1[0] * p2[0] + p1[1] * p2[1]

    #     def subtract(p1, p2):
    #         return (p1[0] - p2[0], p1[1] - p2[1])

    #     def magnitude(p):
    #         return (p[0]**2 + p[1]**2)**0.5

    #     def cosine_angle(p1, p2):
    #         """ Returns the cosine of the angle between two vectors. """
    #         return dot(p1, p2) / (magnitude(p1) * magnitude(p2))

    #     # Calculate vectors from one corner to the neighboring corners
    #     vectors = [
    #         subtract(self.geometric_bounds[i],
    #                  self.geometric_bounds[(i+1) % 4])
    #         for i in range(4)
    #     ]

    #     # For a rectangle, the cosine of the angle between two adjacent sides should be 0 (since cos(90°) = 0)
    #     for i in range(4):
    #         # Using a small threshold to account for numerical inaccuracies
    #         if abs(cosine_angle(vectors[i], vectors[(i+1) % 4])) > 1e-6:
    #             return False

    #     return True

    # ---------------- External Setters------------------

    # ----------------Getters------------------
    def get_image_name(self) -> str:
        # Extract the image name from the URI
        return self.resource_uri.split("/")[-1]

    def get_stored_state(self) -> str:
        return self.stored_state

    def get_item_transform(self) -> str:
        return self.item_transform

    def get_container_item_transform(self) -> str:
        return self.container_item_transform

    def get_container_object_style(self) -> str:
        return self.container_object_style

    def get_image_object_style(self) -> str:
        return self.image_object_style

    def get_link_id(self) -> str:
        return self.link_id

    def get_link_name(self) -> str:
        return self.link_name

    def get_rectangle_link_id(self) -> str:
        return self.grandparent_link_id

    # ----------------String Method------------------
    def __str__(self):
        return f"Image Name: {self.link_name}\n" + \
            f"Resource URI: {self.resource_uri}\n" + \
            f"Stored State: {self.stored_state}\n" + \
            f"Item Transform: {self.item_transform}\n" + \
            f"Container Item Transform: {self.container_item_transform}\n"
