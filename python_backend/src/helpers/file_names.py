import unicodedata
import zipfile
from urllib.parse import unquote

# General-purpose bit 11: the entry name is stored as UTF-8.
_ZIP_UTF8_FLAG = 0x800


def _repair_mojibake(name: str, wrong_codec: str) -> str:
    """Undo UTF-8 bytes that were decoded with a single-byte codec,
    e.g. 'FÃ¶rderturm' (latin-1) or 'F├╢rderturm' (cp437) -> 'Förderturm'.
    Names that aren't mojibake fail the round trip and come back unchanged."""
    if name.isascii():
        return name
    try:
        return name.encode(wrong_codec).decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def normalize_file_name(name: str) -> str:
    """Canonical form for comparing file names: mojibake repaired and NFC.
    macOS stores names decomposed (o + U+0308) while InDesign URIs are
    usually composed, so both sides must be normalized before matching."""
    name = _repair_mojibake(name, 'latin-1')
    name = _repair_mojibake(name, 'cp1252')
    return unicodedata.normalize('NFC', name)


def unquote_uri(uri: str) -> str:
    """Percent-decode a LinkResourceURI. InDesign normally escapes UTF-8
    bytes, but older/Windows exports can escape latin-1 bytes (%F6)."""
    try:
        return unquote(uri, errors='strict')
    except UnicodeDecodeError:
        return unquote(uri, encoding='latin-1')


def zip_member_name(info: zipfile.ZipInfo) -> str:
    """The real name of a zip entry. Without the UTF-8 flag Python decodes
    names as cp437, but macOS Finder and many other tools write UTF-8
    without setting the flag."""
    if info.flag_bits & _ZIP_UTF8_FLAG:
        return info.filename
    return _repair_mojibake(info.filename, 'cp437')
