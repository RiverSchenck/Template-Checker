"""What the package brings besides the layout: files in Links, font files in Document fonts, and the fonts the
document names (Fonts.xml)."""
import logging
import os
from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, Optional, Tuple

from fontTools.ttLib import TTFont

from src.helpers import safe_xml
from src.helpers.file_names import normalize_file_name

logger = logging.getLogger(__name__)

_WINDOWS_ENGLISH = (3, 0x0409)  # (platformID, langID) of the name records InDesign reads


@dataclass(frozen=True)
class PackagedImage:
    """A file in the package's Links folder."""
    name: str           # normalized file name
    size_bytes: int

    @property
    def size_mb(self) -> float:
        return round(self.size_bytes / 1024 ** 2, 2)


def packaged_images(link_files: Iterable[Tuple[str, int]]) -> Tuple[PackagedImage, ...]:
    """link_files: (file name, size in bytes) per file in Links, as listed from the zip."""
    return tuple(PackagedImage(normalize_file_name(name), size) for name, size in link_files)


@dataclass(frozen=True)
class PackagedFont:
    """A font file in Document fonts. family is the family name InDesign uses (typographic family, nameID 16,
    else nameID 1, else the debug name); an unreadable file gets its file name and readable=False."""
    file_name: str
    family: str
    postscript_name: str    # nameID 6: what Frontify matches the file on
    extension: str          # lower case, with the dot
    variable: bool
    readable: bool


def _english_names(font, name_id: int):
    return [str(record.string, 'utf-16-be') for record in font['name'].names
            if record.nameID == name_id and (record.platformID, record.langID) == _WINDOWS_ENGLISH]


def read_font(path: str) -> PackagedFont:
    file_name = os.path.basename(path)
    extension = os.path.splitext(file_name)[1].lower()
    try:
        font = TTFont(path)
        family = (_english_names(font, 16) or [None])[-1] or (_english_names(font, 1) or [None])[-1] \
            or font['name'].getDebugName(1)
        return PackagedFont(file_name, family, font['name'].getDebugName(6) or '', extension, 'fvar' in font, True)
    except Exception as e:
        logger.warning('Unreadable font %s: %s', file_name, e)
        return PackagedFont(file_name, file_name, '', extension, False, False)


def packaged_fonts(folder: str) -> Tuple[PackagedFont, ...]:
    """Every font file in the Document fonts folder (not InDesign's AdobeFnt*.lst index), by file name."""
    if not os.path.isdir(folder):
        return ()
    return tuple(read_font(os.path.join(folder, name)) for name in sorted(os.listdir(folder))
                 if not name.endswith('.lst') and name != '.DS_Store')


@dataclass(frozen=True)
class Face:
    postscript: Optional[str]
    typekit: Optional[str]  # Adobe Fonts id; None for desktop fonts


@dataclass(frozen=True)
class FontFamily:
    """A family in Fonts.xml with its faces by style name (the FontStyle text uses)."""
    name: str
    faces: Mapping[str, Face]
    variable: bool          # any face has design axes


class FontCatalog:
    def __init__(self, families: Iterable[FontFamily]):
        self.families: Tuple[FontFamily, ...] = tuple(families)
        self._by_name: Dict[str, FontFamily] = {}
        for family in self.families:
            self._by_name.setdefault(family.name, family)  # the first one wins, like a search through the list

    def family(self, name: Optional[str]) -> Optional[FontFamily]:
        return self._by_name.get(name) if name else None


def _typekit(value: Optional[str]) -> Optional[str]:
    """InDesign writes an empty '$ID/' for fonts that aren't Adobe Fonts."""
    return None if not value or value == '$ID/' else value


def load_font_catalog(path: str) -> FontCatalog:
    families = []
    for element in safe_xml.parse(path).getroot().iter('FontFamily'):
        fonts = element.findall('.//Font')
        faces = {font.get('FontStyleName'): Face(font.get('PostScriptName') or None, _typekit(font.get('TypekitID')))
                 for font in fonts if font.get('FontStyleName')}
        families.append(FontFamily(element.get('Name'), faces,
                                   any(font.get('NumDesignAxes') is not None for font in fonts)))
    return FontCatalog(families)
