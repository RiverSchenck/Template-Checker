import pytest
import os
from src.classes.FrontifyChecker import FrontifyChecker
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo
from collections import Counter


def format_counter_diff(expected: Counter, actual: Counter, label: str) -> tuple:
    """Format differences between expected and actual Counters in a readable way.
    Returns (detailed_message, summary_line) tuple."""
    if expected == actual:
        return ("", "")

    lines = [f"\n{label} Differences:"]
    summary_parts = []
    all_keys = set(expected.keys()) | set(actual.keys())

    for key in sorted(all_keys):
        expected_count = expected.get(key, 0)
        actual_count = actual.get(key, 0)

        if expected_count != actual_count:
            if actual_count > expected_count:
                diff = actual_count - expected_count
                lines.append(f"  {key}: Expected {expected_count}, Got {actual_count} (+{diff} extra)")
                summary_parts.append(f"{key}: +{diff}")
            else:
                diff = expected_count - actual_count
                lines.append(f"  {key}: Expected {expected_count}, Got {actual_count} (-{diff} missing)")
                summary_parts.append(f"{key}: -{diff}")

    detailed = "\n".join(lines)
    summary = f"DIFF: {', '.join(summary_parts)}"
    return (detailed, summary)

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
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
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
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
            f"{ValidationWarning.HYPHENATION.value}",
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

    # Extract expected outcomes for the current testcase_zip
    filename = os.path.basename(testcase_zip)
    # If the expected outcome for the file is not found, skip the test
    if filename not in EXPECTED_OUTCOMES:
        pytest.skip(f"Expected outcome for {filename} not found")
    expected_errors = EXPECTED_OUTCOMES[filename].get("errors", [])
    expected_warnings = EXPECTED_OUTCOMES[filename].get("warnings", [])
    expected_infos = EXPECTED_OUTCOMES[filename].get("infos", [])

    # Combine IMAGE_TRANSFORMATION_IMAGE and IMAGE_TRANSFORMATION_CONTAINER counts
    # for comparison with expected outcomes (which use the old IMAGE_TRANSFORMATION type)
    def combine_image_transformation_counts(counter):
        combined = Counter()
        image_transformation_total = 0
        for key, value in counter.items():
            if key in [ValidationError.IMAGE_TRANSFORMATION_IMAGE.value,
                       ValidationError.IMAGE_TRANSFORMATION_CONTAINER.value]:
                image_transformation_total += value
            else:
                combined[key] = value
        if image_transformation_total > 0:
            combined[ValidationError.IMAGE_TRANSFORMATION.value] = image_transformation_total
        return combined

    def combine_image_transformation_warning_counts(counter):
        combined = Counter()
        image_transformation_total = 0
        for key, value in counter.items():
            if key in [ValidationWarning.IMAGE_TRANSFORMATION_IMAGE.value,
                       ValidationWarning.IMAGE_TRANSFORMATION_CONTAINER.value]:
                image_transformation_total += value
            else:
                combined[key] = value
        if image_transformation_total > 0:
            combined[ValidationWarning.IMAGE_TRANSFORMATION.value] = image_transformation_total
        return combined

    actual_errors_count = combine_image_transformation_counts(Counter(actual_errors))
    expected_errors_count = Counter(expected_errors)

    actual_warnings_count = combine_image_transformation_warning_counts(Counter(actual_warnings))
    expected_warnings_count = Counter(expected_warnings)

    actual_infos_count = Counter(actual_infos)
    expected_infos_count = Counter(expected_infos)

    # Build readable diff message
    diff_detailed = ""
    diff_summary_parts = []
    if actual_errors_count != expected_errors_count:
        detailed, summary = format_counter_diff(expected_errors_count, actual_errors_count, "Errors")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)
    if actual_warnings_count != expected_warnings_count:
        detailed, summary = format_counter_diff(expected_warnings_count, actual_warnings_count, "Warnings")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)
    if actual_infos_count != expected_infos_count:
        detailed, summary = format_counter_diff(expected_infos_count, actual_infos_count, "Infos")
        diff_detailed += detailed
        if summary:
            diff_summary_parts.append(summary)

    if diff_detailed:
        print(diff_detailed)  # Print detailed differences so they're always visible
        # Create summary message for pytest.fail() that appears in summary line
        summary_msg = " | ".join(diff_summary_parts)
        pytest.fail(f"{summary_msg}\n{diff_detailed}")


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

    # Assert
    assert not actual_errors

    assert not actual_warnings

    assert not actual_infos
