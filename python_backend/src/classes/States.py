from enum import Enum, auto


# **********************************************************
# Class: States
# Init Locations: FrontifyChecker
# Methods calls from:
# Method calls to:
# Description: Declares the state machine states.
# **********************************************************
class States(Enum):
    GET_ZIP = auto()
    UNZIP_PACKAGE = auto()
    UNZIP_IDML = auto()
    PARSE_XML = auto()
    MASTERPAGE_CHECK = auto()
    PAR_CHECK = auto()
    HYPHENATION_CHECK = auto()
    KERNING_CHECK = auto()
    OVERRIDES_CHECK = auto()
    FONTS_INCLUDED_CHECK = auto()
    OTF_TTF_FONT_CHECK = auto()
    VARIABLE_FONT_CHECK = auto()
    IMAGES_INCLUDED_CHECK = auto()
    LARGE_IMAGE_CHECK = auto()
    EMBEDDED_IMAGE_CHECK = auto()
    IMAGE_TRANSFORMATION_CHECK = auto()
    TABLE_CHECK = auto()
    AUTO_SIZE_TEXT_BOX_CHECK = auto()
    PASTED_GRAPHICS_CHECK = auto()
    DOCUMENT_BLEED_CHECK = auto()
    TEXT_COLUMNS_CHECK = auto()
    TEXT_WRAP_CHECK = auto()
    LINKED_TEXT_FRAME_CHECK = auto()
    OBJECT_STYLE_CHECK = auto()
    GRID_ALIGNMENT_CHECK = auto()
    COMPOSER_CHECK = auto()
    OTHER_CHECKS = auto()
    RESULTS = auto()
    IDLE = auto()
    EXIT = auto()
