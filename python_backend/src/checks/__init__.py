"""Every template check, in the order they run.

To add a check: write `def my_check(doc: ParsedDocument, results: ValidationResult) -> None` in the
module for its theme, add a States member for it, and add it to CHECKS. The issues it reports are
classifiers in src/results/classifiers.py (adding one is a single line there plus its guide; see
docs/validation-classifier-reference.md). The state name is stored in analytics as the step a run
stopped at (runs.stopped_at_stage), so never rename an existing one.
"""
from dataclasses import dataclass
from typing import Callable

from src.checks import fonts, images, layout, text
from src.classes.States import States
from src.document import ParsedDocument
from src.results.results import ValidationResult


@dataclass(frozen=True)
class Check:
    state: States
    run: Callable[[ParsedDocument, ValidationResult], None]
    needs_stories: bool = False  # skipped when the IDML has no Stories/ folder


CHECKS = (
    Check(States.MASTERPAGE_CHECK, layout.masterpage_check),
    Check(States.PAR_CHECK, text.par_style_check, needs_stories=True),
    Check(States.HYPHENATION_CHECK, text.hyphenation_check, needs_stories=True),
    Check(States.OVERRIDES_CHECK, text.overrides_check, needs_stories=True),
    Check(States.KERNING_CHECK, text.kerning_check, needs_stories=True),
    Check(States.FONTS_INCLUDED_CHECK, fonts.fonts_included_check),
    Check(States.ADOBE_FONT_CHECK, fonts.adobe_font_check),
    Check(States.OTF_TTF_FONT_CHECK, fonts.otf_ttf_font_check),
    Check(States.VARIABLE_FONT_CHECK, fonts.variable_font_check),
    Check(States.IMAGES_INCLUDED_CHECK, images.images_included_check),
    Check(States.LARGE_IMAGE_CHECK, images.large_image_check),
    Check(States.EMBEDDED_IMAGE_CHECK, images.embedded_image_check),
    Check(States.IMAGE_TRANSFORMATION_CHECK, images.image_transformation_check),
    Check(States.PAGE_ITEM_TRANSFORMATION_CHECK, layout.page_item_transformation_check),
    Check(States.TABLE_CHECK, text.table_check, needs_stories=True),
    Check(States.PASTED_GRAPHICS_CHECK, layout.pasted_graphics_check),
    Check(States.DOCUMENT_BLEED_CHECK, layout.document_bleed_check),
    Check(States.AUTO_SIZE_TEXT_BOX_CHECK, layout.auto_size_text_box_check),
    Check(States.TEXT_COLUMNS_CHECK, layout.text_columns_check),
    Check(States.TEXT_WRAP_CHECK, layout.text_wrap_check),
    Check(States.LINKED_TEXT_FRAME_CHECK, layout.linked_text_frame_check),
    Check(States.OBJECT_STYLE_CHECK, layout.object_style_check),
    Check(States.GRID_ALIGNMENT_CHECK, text.grid_alignment_check, needs_stories=True),
    Check(States.COMPOSER_CHECK, text.composer_check, needs_stories=True),
    Check(States.OTHER_CHECKS, text.other_checks, needs_stories=True),
    Check(States.POSITION_CHECK, text.position_check, needs_stories=True),
)

CHECKS_BY_STATE = {check.state: check for check in CHECKS}
