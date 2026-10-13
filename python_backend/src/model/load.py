"""load_document: an unpacked package -> Document. The only place the model touches the file system."""
import os
from typing import Iterable, Optional, Tuple

from src.helpers import safe_xml
from src.model.assets import FontCatalog, load_font_catalog, packaged_fonts, packaged_images
from src.model.document import Document
from src.model.layout import load_layout
from src.model.styles import StyleSheet, load_styles
from src.model.text import load_stories

BLEED_SIDES = {'top': 'DocumentBleedTopOffset', 'bottom': 'DocumentBleedBottomOffset',
               'inside': 'DocumentBleedInsideOrLeftOffset', 'outside': 'DocumentBleedOutsideOrRightOffset'}


def _bleed(preferences_path: str):
    preference = safe_xml.parse(preferences_path).getroot().find('.//DocumentPreference')
    return {side: preference.get(attribute) for side, attribute in BLEED_SIDES.items()} if preference is not None else None


def load_document(idml_folder: str, link_files: Iterable[Tuple[str, int]] = (),
                  fonts_folder: Optional[str] = None) -> Document:
    """The Document for an unpacked .idml. link_files: (name, size) per file in the package's Links folder;
    fonts_folder: its Document fonts folder. Required files (Spreads, Fonts.xml, Styles.xml, Preferences.xml)
    are checked by the intake before this is called."""
    resources = os.path.join(idml_folder, 'Resources')
    layout = load_layout(idml_folder)
    stories_folder = os.path.join(idml_folder, 'Stories')
    fonts_xml, styles_xml = os.path.join(resources, 'Fonts.xml'), os.path.join(resources, 'Styles.xml')
    preferences_xml = os.path.join(resources, 'Preferences.xml')
    return Document(
        styles=load_styles(styles_xml) if os.path.exists(styles_xml) else StyleSheet({}),
        spreads=layout.spreads,             # document order (designmap.xml), as InDesign shows them
        masters=layout.masters,
        stories=load_stories(stories_folder) if os.path.isdir(stories_folder) else None,
        font_catalog=load_font_catalog(fonts_xml) if os.path.exists(fonts_xml) else FontCatalog(()),
        packaged_images=packaged_images(link_files),
        packaged_fonts=packaged_fonts(fonts_folder) if fonts_folder else (),
        bleed=_bleed(preferences_xml) if os.path.exists(preferences_xml) else None,
        geometry=layout.geometry,
    )
