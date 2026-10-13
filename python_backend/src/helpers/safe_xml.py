"""The one way the checker parses XML from an uploaded package.

Settings are explicit rather than left to lxml/libxml2 defaults (which have changed between versions): entities
are never resolved, nothing is fetched from the network, and a DTD (IDML never has one) is refused. Spreads,
stories and master spreads can hold pasted graphics as very large text, so they're parsed with libxml2's size
limits off (huge_tree) and get an explicit file size cap instead.
"""
import os

from lxml import etree

# The largest spread in the test corpus is 24 MB (pasted graphics).
MAX_LARGE_FILE_BYTES = 256 * 1024 * 1024


class UnsafeXMLError(ValueError):
    """The file declares a DTD or is over the size cap."""


class TooLargeError(UnsafeXMLError):
    """The file is over MAX_LARGE_FILE_BYTES."""


def parse(path: str, *, large: bool = False) -> etree._ElementTree:
    """Parse an XML file from a package. large=True for spreads, stories and master spreads."""
    name = os.path.basename(path)
    if large and os.path.getsize(path) > MAX_LARGE_FILE_BYTES:
        raise TooLargeError(f'{name} is larger than {MAX_LARGE_FILE_BYTES // 2 ** 20} MB')
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=large)
    tree = etree.parse(path, parser)
    if tree.docinfo.doctype:
        raise UnsafeXMLError(f'{name} declares a DTD')
    return tree


def within(folder: str, relative_path: str):
    """folder/relative_path, or None when it would point outside folder (e.g. '../', an absolute path or a
    symlink out)."""
    path = os.path.join(folder, relative_path)
    return path if os.path.realpath(path).startswith(os.path.realpath(folder) + os.sep) else None
