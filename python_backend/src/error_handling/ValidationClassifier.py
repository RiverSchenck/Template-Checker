from enum import Enum, auto


class ValidationCategory(Enum):
    PAR_STYLE = (auto(), "Paragraph Styles")
    CHAR_STYLE = (auto(), "Character Styles")
    TEXT_BOX = (auto(), "Text Boxes")
    FONTS = (auto(), "Fonts")
    IMAGES = (auto(), "Images")
    GENERAL = (auto(), "General")

    def __init__(self, value, label=None):
        self._value_ = value
        self.label = label


class ValidationError(Enum):
    ERROR = (auto(),
             "error (Check tooltip for context)",
             None, 'Error', ValidationCategory.GENERAL)
    FOLDER = (auto(),
              "Folder error",
              None, 'Folder', ValidationCategory.GENERAL)
    IDML = (auto(),
            "IDML error",
            None, 'IDML', ValidationCategory.GENERAL)
    ZIP = (auto(),
           "ZIP file error",
           "https://help.frontify.com/en/articles/5306557-what-input-formats-do-digital-and-print-templates-support", None, ValidationCategory.GENERAL)
    MASTERPAGE = (auto(),
                  "Master Page can't be used.",
                  "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_4bef512504",
                  "Masterpage", ValidationCategory.GENERAL)
    PARAGRAPH_STYLE = (auto(),
                       "Text found missing paragraph styles.",
                       "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775",
                       "Paragraph Style", ValidationCategory.TEXT_BOX)
    PARAGRAPH_STYLE_TEXT_BOX = (auto(),
                                "No paragraph styles were used.",
                                "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775",
                                "Paragraph Style", ValidationCategory.TEXT_BOX)
    FONTS_INCLUDED = (auto(),
                      "Package is missing fonts.",
                      "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981",
                      "Fonts Included", ValidationCategory.FONTS)
    OTF_TTF_FONT = (auto(),
                    "Only OTF or TTF fonts are supported.",
                    "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981",
                    "OTF/TTF Font", ValidationCategory.FONTS)
    VARIABLE_FONT = (auto(),
                     "Variable fonts are not supported",
                     "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981",
                     "Variable Font", ValidationCategory.FONTS)
    IMAGE_INCLUDED = (auto(),
                      "Package missing image link.",
                      "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_eba8d9b8c1",
                      "Images Included", ValidationCategory.IMAGES)
    EMBEDDED_IMAGE = (auto(),
                      "Embedded images are not supported.",
                      "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d",
                      "Embedded Image", ValidationCategory.IMAGES)
    IMAGE_TRANSFORMATION = (auto(),
                            "Image transformations are not supported.",
                            "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4",
                            "Image Transformation", ValidationCategory.IMAGES)
    TABLE = (auto(),
             "Tables are not supported",
             "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_b333040b53",
             "Table", ValidationCategory.TEXT_BOX)
    PASTED_GRAPHICS = (auto(),
                       "Pasted graphics are not supported",
                       "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d",
                       "Pasted Graphics", ValidationCategory.IMAGES)
    AUTO_SIZE_TEXT_BOX = (auto(),
                          "Auto-size text boxes were not set up properly",
                          "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_e69bd3114b",
                          "Auto Sizing Text Box", ValidationCategory.TEXT_BOX)
    TEXT_COLUMNS = (auto(),
                    "Text columns are not supported",
                    "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_2ea0534af5",
                    "Text Column", ValidationCategory.TEXT_BOX)
    LINKED_TEXT_FRAME = (auto(),
                         "Linked (threaded) text frames are not supported.",
                         "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_befb8c0698",
                         "Linked Text Frame", ValidationCategory.TEXT_BOX)
    OBJECT_STYLE_TEXT = (auto(),
                         "Object styles are not supported.",
                         "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a92f4cebdf",
                         "Object Style", ValidationCategory.TEXT_BOX)

    OBJECT_STYLE_IMAGE = (auto(),
                          "Object styles are not supported.",
                          "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a92f4cebdf",
                          "Object Style", ValidationCategory.IMAGES)

    GRID_ALIGNMENT = (auto(),
                      "Grid alignment is not supported",
                      "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_f6aa8d5242",
                      "Grid Alignment", ValidationCategory.PAR_STYLE)
    KERNING = (auto(),
               "Kerning must be 'Metrics'",
               "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d",
               "Kerning", ValidationCategory.PAR_STYLE)
    KERNING_CHAR = (auto(),
                    "Kerning must be 'Metrics'",
                    "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d",
                    "Kerning", ValidationCategory.CHAR_STYLE)

    TEXT_WRAP = (auto(),
                 "Text Wrap is not supported.",
                 "https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates",
                 "Text Wrap", ValidationCategory.TEXT_BOX)
    
    FILL_TINT = (auto(),
                 "Fill Tint must be 100. (This may be inaccurate, testing currently)",
                 "https://help.frontify.com",
                 "Color Fill Tint (Beta)", ValidationCategory.PAR_STYLE)

    def __new__(cls, _, message=None, help_article=None, label=None, category=ValidationCategory.GENERAL):
        member = object.__new__(cls)
        member.message = message
        member.help_article = help_article
        member.label = label
        member.category = category
        return member


class ValidationWarning(Enum):
    WARNING = auto()
    HYPHENATION = (auto(),
                   "Hyphenation is not supported.",
                   "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_55fa4b04cf",
                   "Hyphenation", ValidationCategory.PAR_STYLE)
    OVERRIDE = (auto(),
                "Overrides are not supported.",
                "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775",
                "Override", ValidationCategory.TEXT_BOX)
    UNUSED_IMAGE = (auto(),
                    "Image(s) in package are unused making the package larger in size.",
                    "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2",
                    "Unused Image", ValidationCategory.IMAGES)
    IMAGE_TRANSFORMATION = (auto(),
                            "Element has been rotated. You may see slight discrepencies between export and editing.",
                            "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4",
                            "Image Transformation", ValidationCategory.IMAGES)
    DOCUMENT_BLEED = (auto(),
                      "InDesign defined bleed is applied.",
                      "https://help.frontify.com/en/articles/8519462-bleed-settings-and-pdf-presets-for-digital-print-templates-indesign-based",
                      "Document Bleed", ValidationCategory.GENERAL)
    COMPOSER = (auto(),
                "We recommend defining paragraph style composers as 'Adobe Single-line Composer', as browsers can render this composer. Otherwise, discrepencies between export and editing may occur.",
                "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_bfdd4bceb0",
                "Composer", ValidationCategory.PAR_STYLE)

    def __new__(cls, _, message=None, help_article=None, label=None, category=ValidationCategory.GENERAL):
        member = object.__new__(cls)
        member.message = message
        member.help_article = help_article
        member.label = label
        member.category = category
        return member


class ValidationInfo(Enum):
    EMPTY_TEXT_FRAME = (auto(),
                        "Empty text frame found.",
                        "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775",
                        "Empty Text Frames", ValidationCategory.TEXT_BOX)
    LARGE_IMAGE = (auto(),
                   "Image is large. Verify that this large of an image is needed.",
                   "http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2",
                   "Large Image", ValidationCategory.IMAGES)

    def __new__(cls, _, message=None, help_article=None, label=None, category=ValidationCategory.GENERAL):
        member = object.__new__(cls)
        member.message = message
        member.help_article = help_article
        member.label = label
        member.category = category
        return member


# This ensures that the enum name is the same as its value
for classifier in ValidationError:
    classifier._value_ = classifier.name

for classifier in ValidationWarning:
    classifier._value_ = classifier.name

for classifier in ValidationInfo:
    classifier._value_ = classifier.name

for classifier in ValidationCategory:
    classifier._value_ = classifier.name
