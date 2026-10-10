"""Safe, selective intake of an uploaded template package (.zip) and the .idml inside it.

Everything is decided from the zip's central directory before a byte is written:
- names that could escape the target folder are rejected,
- archives that would unpack too large (zip bombs) or into too many files are rejected,
- only what the checks read is extracted: the .idml, Document Fonts and the package PDF.

Links are never extracted. The checks only need each link's name and size, which the
central directory already has, and Links are usually the bulk of a package.

Declared sizes can be trusted as upper bounds: zipfile never reads past an entry's
declared size and verifies its CRC, so a lying header fails instead of over-writing.
"""
import os
import posixpath
import shutil
import unicodedata
import zipfile
from dataclasses import dataclass, field
from typing import List, Tuple

from src.helpers.file_names import zip_member_name

MAX_PACKAGE_ENTRIES = 20_000
# Fonts + package PDF + the .idml itself, as written to disk.
MAX_PACKAGE_EXTRACTED_BYTES = 1024 ** 3  # 1 GiB
MAX_IDML_ENTRIES = 20_000
MAX_IDML_EXTRACTED_BYTES = 512 * 1024 ** 2  # 512 MiB of XML is far beyond any real document

_COPY_CHUNK = 1024 * 1024


class PackageError(Exception):
    """The upload can't be checked. The message is safe to show to the user."""


class NoIdmlError(PackageError):
    def __init__(self):
        super().__init__('No .idml file found in the provided package.')


class MultipleIdmlError(PackageError):
    def __init__(self):
        super().__init__("Multiple .idml files found in the provided package. Please ensure there's only one .idml file.")


@dataclass
class Package:
    folder: str  # Package folder inside the zip: '' or 'Some Folder'
    idml: zipfile.ZipInfo
    links: List[Tuple[str, int]] = field(default_factory=list)  # (file name, size in bytes)
    fonts: List[zipfile.ZipInfo] = field(default_factory=list)
    pdfs: List[zipfile.ZipInfo] = field(default_factory=list)


def _safe_parts(info: zipfile.ZipInfo) -> List[str]:
    """Path components of an entry under its real (decoded, NFC) name. Rejects anything that could escape."""
    name = unicodedata.normalize('NFC', zip_member_name(info)).replace('\\', '/')
    parts = [p for p in name.split('/') if p not in ('', '.')]
    if name.startswith('/') or any(p == '..' for p in parts) or (parts and ':' in parts[0]):
        raise PackageError('The package contains files with unsafe paths and cannot be checked.')
    return parts


def _files(zf: zipfile.ZipFile, max_entries: int, what: str) -> List[Tuple[zipfile.ZipInfo, List[str]]]:
    infos = zf.infolist()
    if len(infos) > max_entries:
        raise PackageError(f'The {what} contains too many files ({len(infos):,}). The limit is {max_entries:,}.')
    files = []
    for info in infos:
        parts = _safe_parts(info)
        if info.is_dir() or not parts:
            continue
        if info.flag_bits & 0x1:
            raise PackageError(f'The {what} is password-protected and cannot be checked.')
        files.append((info, parts))
    return files


def _check_size(infos: List[zipfile.ZipInfo], limit: int, what: str):
    total = sum(info.file_size for info in infos)
    if total > limit:
        raise PackageError(
            f'The {what} unpacks to {total / 1024 ** 2:,.0f} MB, more than the {limit / 1024 ** 2:,.0f} MB limit.')


def read_package(zf: zipfile.ZipFile) -> Package:
    """Validate the package and work out what to extract, from the central directory alone."""
    files = [(info, parts) for info, parts in _files(zf, MAX_PACKAGE_ENTRIES, 'package')
             if parts[0] != '__MACOSX' and parts[-1] != '.DS_Store']

    # The .idml sits at the top of the zip, or inside the one folder the package was zipped from.
    idmls = [(info, parts) for info, parts in files if len(parts) <= 2 and parts[-1].lower().endswith('.idml')]
    at_root = [entry for entry in idmls if len(entry[1]) == 1]
    candidates = at_root or idmls
    if not candidates:
        raise NoIdmlError()
    if len(candidates) > 1:
        raise MultipleIdmlError()
    idml, idml_parts = candidates[0]
    depth = len(idml_parts) - 1
    folder = idml_parts[:depth]

    package = Package(folder='/'.join(folder), idml=idml)
    for info, parts in files:
        if parts[:depth] != folder:
            continue
        rel = parts[depth:]
        if len(rel) == 1 and rel[0].lower().endswith('.pdf') and not rel[0].startswith('.'):
            package.pdfs.append(info)
        elif len(rel) == 2 and rel[0].lower() == 'links':
            package.links.append((rel[1], info.file_size))
        elif len(rel) == 2 and rel[0].lower() == 'document fonts':
            package.fonts.append(info)

    _check_size([package.idml, *package.fonts, *package.pdfs], MAX_PACKAGE_EXTRACTED_BYTES, 'package')
    return package


def _extract(zf: zipfile.ZipFile, info: zipfile.ZipInfo, parts: List[str], dest_root: str) -> str:
    target = os.path.join(dest_root, *parts)
    # _safe_parts already rejects escapes; this is the last line of defence.
    if os.path.commonpath([os.path.realpath(dest_root), os.path.realpath(target)]) != os.path.realpath(dest_root):
        raise PackageError('The package contains files with unsafe paths and cannot be checked.')
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with zf.open(info) as src, open(target, 'wb') as out:
        shutil.copyfileobj(src, out, _COPY_CHUNK)
    return target


def extract_package(zf: zipfile.ZipFile, package: Package, dest_root: str) -> Tuple[str, str]:
    """Write the .idml, Document Fonts and package PDFs under dest_root, keeping their zip layout.

    Returns (package folder path, .idml path) on disk.
    """
    idml_path = ''
    for info in [package.idml, *package.fonts, *package.pdfs]:
        path = _extract(zf, info, _safe_parts(info), dest_root)
        if info is package.idml:
            idml_path = path
    folder_path = os.path.join(dest_root, *package.folder.split('/')) if package.folder else dest_root
    return folder_path, idml_path


def extract_idml(idml_path: str, dest: str):
    """Unpack the .idml (itself a zip of XML files) into dest, with the same safety checks."""
    try:
        with zipfile.ZipFile(idml_path) as zf:
            files = _files(zf, MAX_IDML_ENTRIES, '.idml file')
            _check_size([info for info, _ in files], MAX_IDML_EXTRACTED_BYTES, '.idml file')
            for info, parts in files:
                _extract(zf, info, parts, dest)
    except zipfile.BadZipFile:
        raise PackageError('The .idml file is damaged and cannot be opened. Please export it again from InDesign.')
