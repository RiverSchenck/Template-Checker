import io
import os
import unicodedata
import zipfile

import pytest
from lxml import etree as ET

from src.classes.Image import Image
from src.classes.Link import Link
from src.helpers.file_names import extract_zip, normalize_file_name, unquote_uri

NAME = 'logo_Förderturm_original.png'


def make_link(resource_uri: str) -> Link:
    # Link reads attributes off its parent (image) and grandparent (frame).
    rect = ET.Element('Rectangle', Self='u1')
    image = ET.SubElement(rect, 'Image', Self='u2')
    link = ET.SubElement(image, 'Link', Self='u3',
                         LinkResourceURI=resource_uri, StoredState='Normal')
    return Link(link)


@pytest.mark.parametrize('uri', [
    # UTF-8 percent-escapes (normal InDesign output)
    'file:/Users/me/Folder/Links/logo_F%C3%B6rderturm_original.png',
    # latin-1 percent-escapes
    'file:/Users/me/Folder/Links/logo_F%F6rderturm_original.png',
    # UTF-8 bytes already mis-decoded as latin-1
    'file:/Users/me/Folder/Links/logo_FÃ¶rderturm_original.png',
    # decomposed (macOS NFD) form
    'file:/Users/me/Folder/Links/' + unicodedata.normalize('NFD', NAME),
])
def test_link_name_round_trips(uri):
    assert make_link(uri).get_image_name() == NAME


def test_plain_latin1_name_is_left_alone():
    assert normalize_file_name('Förderturm.png') == 'Förderturm.png'
    assert unquote_uri('a%20b.png') == 'a b.png'


def _zip_without_utf8_flag(name: str, data: bytes) -> bytes:
    """Python always sets the UTF-8 flag for non-ASCII names, so write an
    ASCII placeholder of the same byte length and patch the raw bytes, the
    way macOS Finder / older tools store names."""
    encoded = name.encode('utf-8')
    placeholder = b'x' * len(encoded)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr('Pkg Folder/Links/' + placeholder.decode(), data)
    raw = buf.getvalue()
    assert raw.count(placeholder) == 2  # local header + central directory
    return raw.replace(placeholder, encoded)


def test_zip_without_utf8_flag_extracts_and_matches_link(tmp_path):
    raw = _zip_without_utf8_flag(unicodedata.normalize('NFD', NAME), b'png')
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        assert not zf.infolist()[0].flag_bits & 0x800
        extract_zip(zf, str(tmp_path))

    links_dir = tmp_path / 'Pkg Folder' / 'Links'
    files = os.listdir(links_dir)
    assert len(files) == 1
    assert unicodedata.normalize('NFC', files[0]) == NAME

    image = Image(str(links_dir / files[0]))
    link = make_link('file:/Users/me/Pkg%20Folder/Links/logo_F%C3%B6rderturm_original.png')
    assert image.get_image_name() == link.get_image_name() == NAME
