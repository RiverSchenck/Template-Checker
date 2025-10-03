import pytest
import os
from src.classes.FrontifyChecker import FrontifyChecker
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo
from collections import Counter

EXPECTED_OUTCOMES = {
    "Full coverage errors Folder.zip": {
        "errors": [
            f"{ValidationError.MASTERPAGE.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
            f"{ValidationError.OTF_TTF_FONT.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
            f"{ValidationError.IMAGE_INCLUDED.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",
            f"{ValidationError.TABLE.value}",
            f"{ValidationError.PASTED_GRAPHICS.value}",
            f"{ValidationError.AUTO_SIZE_TEXT_BOX.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.OBJECT_STYLE_IMAGE.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",

        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.UNUSED_IMAGE.value}",
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
        ],
        "infos": [
            f"{ValidationInfo.EMPTY_TEXT_FRAME.value}",
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "Another Test.zip": {
        "errors": [
            f"{ValidationError.MASTERPAGE.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",

        ],
        "warnings": [
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.COMPOSER.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
        ]
    },
    "VOITH_Bad Folder.zip": {
        "errors": [
            f"{ValidationError.MASTERPAGE.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.TABLE.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",
            f"{ValidationError.OBJECT_STYLE_IMAGE.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",

        ],
        "warnings": [
            f"{ValidationWarning.COMPOSER.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
        ],
        "infos": [
            f"{ValidationInfo.EMPTY_TEXT_FRAME.value}",
        ]
    },
    "Packaging_Bad Folder.zip": {
        "errors": [
            f"{ValidationError.MASTERPAGE.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",
            f"{ValidationError.PASTED_GRAPHICS.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.OTF_TTF_FONT.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.OVERRIDE.value}",
        ],
        "infos": [
            f"{ValidationInfo.EMPTY_TEXT_FRAME.value}",
        ]
    },
    "Shopping-Bag_Bad.zip": {
        "errors": [
            f"{ValidationError.TABLE.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
            f"{ValidationError.OBJECT_STYLE_TEXT.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",
            f"{ValidationError.AUTO_SIZE_TEXT_BOX.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.UNUSED_IMAGE.value}",
        ],
        "infos": [
            f"{ValidationInfo.EMPTY_TEXT_FRAME.value}",
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "RollUp_Bad.zip": {
        "errors": [
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",
            f"{ValidationError.AUTO_SIZE_TEXT_BOX.value}",
            f"{ValidationError.PASTED_GRAPHICS.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.OTF_TTF_FONT.value}",

        ],
        "warnings": [
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.UNUSED_IMAGE.value}",
        ],
        "infos": [
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
    "Sammelform-Price-Tag_Bad.zip": {
        "errors": [
            f"{ValidationError.FONTS_INCLUDED.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
        ],
        "warnings": [
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
        ]
    },
    "Brochure_Bad.zip": {
        "errors": [
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
        ]
    },
    "Fact-Sheet-Images_Bad.zip": {
        "errors": [
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE.value}",
            f"{ValidationError.PARAGRAPH_STYLE.value}",
            f"{ValidationError.PARAGRAPH_STYLE.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.COMPOSER.value}",
        ]
    },
    "Flyer-Sales_Bad.zip": {
        "errors": [
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
        ]
    },
    "Lookbook_Bad.zip": {
        "errors": [
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.OVERRIDE.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
        ]
    },
    "All_err_and_warn.zip": {
        "errors": [
            f"{ValidationError.MASTERPAGE.value}",
            f"{ValidationError.PARAGRAPH_STYLE_TEXT_BOX.value}",
            f"{ValidationError.VARIABLE_FONT.value}",
            f"{ValidationError.IMAGE_INCLUDED.value}",
            f"{ValidationError.EMBEDDED_IMAGE.value}",
            f"{ValidationError.IMAGE_TRANSFORMATION.value}",
            f"{ValidationError.TABLE.value}",
            f"{ValidationError.PASTED_GRAPHICS.value}",
            f"{ValidationError.AUTO_SIZE_TEXT_BOX.value}",
            f"{ValidationError.TEXT_COLUMNS.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.LINKED_TEXT_FRAME.value}",
            f"{ValidationError.OBJECT_STYLE_IMAGE.value}",
            f"{ValidationError.GRID_ALIGNMENT.value}",
            f"{ValidationError.OTF_TTF_FONT.value}",
            f"{ValidationError.FONTS_INCLUDED.value}",
        ],
        "warnings": [
            f"{ValidationWarning.OVERRIDE.value}",
            f"{ValidationWarning.IMAGE_TRANSFORMATION.value}",
            # f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.COMPOSER.value}",
            f"{ValidationWarning.DOCUMENT_BLEED.value}",
            f"{ValidationWarning.UNUSED_IMAGE.value}",
        ],
        "infos": [
            f"{ValidationInfo.EMPTY_TEXT_FRAME.value}",
            f"{ValidationInfo.LARGE_IMAGE.value}",
        ]
    },
}


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FAIL_DATA_DIR = os.path.join(BASE_DIR, 'fail_data')
PASS_DATA_DIR = os.path.join(BASE_DIR, 'pass_data')


def setup_instance(source_file_path):
    checkerInstance = FrontifyChecker()
    checkerInstance.set_source_file_path(source_file_path)
    return checkerInstance


@pytest.mark.parametrize('testcase_zip', [os.path.join(FAIL_DATA_DIR, f) for f in os.listdir(FAIL_DATA_DIR) if f.endswith('.zip')])
def test_zip_check_fail(testcase_zip):
    print(f"Running FAIL test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Execute
    checker.run_state_machine()
    # Cleanup files
    print(checker.delete_unzipped_root_path())

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()

    print('Actual Errors:')
    for error in actual_errors:
        print(error)
    print("Actual Warnings:")
    for warning in actual_warnings:
        print(warning)
    print("Actual Infos:")
    for info in actual_infos:
        print(info)

    # Extract expected outcomes for the current testcase_zip
    filename = os.path.basename(testcase_zip)
    # If the expected outcome for the file is not found, skip the test
    if filename not in EXPECTED_OUTCOMES:
        pytest.skip(f"Expected outcome for {filename} not found")
    expected_errors = EXPECTED_OUTCOMES[filename].get("errors", [])
    expected_warnings = EXPECTED_OUTCOMES[filename].get("warnings", [])
    expected_infos = EXPECTED_OUTCOMES[filename].get("infos", [])

    actual_errors_count = Counter(actual_errors)
    expected_errors_count = Counter(expected_errors)

    actual_warnings_count = Counter(actual_warnings)
    expected_warnings_count = Counter(expected_warnings)

    actual_infos_count = Counter(actual_infos)
    expected_infos_count = Counter(expected_infos)

    assert actual_errors_count == expected_errors_count, f"Expected {expected_errors_count} but got {actual_errors_count}"
    assert actual_warnings_count == expected_warnings_count, f"Expected {expected_warnings_count} but got {actual_warnings_count}"
    assert actual_infos_count == expected_infos_count, f"Expected {expected_infos_count} but got {actual_infos_count}"


@pytest.mark.parametrize('testcase_zip', [os.path.join(PASS_DATA_DIR, f) for f in os.listdir(PASS_DATA_DIR) if f.endswith('.zip')])
def test_zip_check_pass(testcase_zip):
    print(f"Running PASS test with {testcase_zip}")
    # Setup
    checker = setup_instance(testcase_zip)
    # Exuecute
    checker.run_state_machine()
    # Cleanup files
    checker.delete_unzipped_root_path()

    # Extract Error and Warnings
    actual_errors = checker.get_error_types()
    actual_warnings = checker.get_warning_types()
    actual_infos = checker.get_info_types()

    print('Actual Errors:')
    for error in actual_errors:
        print(error)
    print("Actual Warnings:")
    for warning in actual_warnings:
        print(warning)
    print("Actual Infos:")
    for info in actual_infos:
        print(info)

    # Assert
    assert not actual_errors

    assert not actual_warnings

    assert not actual_infos
