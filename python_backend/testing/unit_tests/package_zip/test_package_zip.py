import io
import os
import zipfile

import pytest

from src.helpers import package_zip
from src.helpers.package_zip import (
    MultipleIdmlError, NoIdmlError, PackageError, extract_idml, extract_package, read_package)


def make_zip(entries, compression=zipfile.ZIP_DEFLATED):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', compression) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    buf.seek(0)
    return zipfile.ZipFile(buf)


def raw_name_zip(name, data=b'x'):
    """A bare ZipInfo keeps the name exactly as given, including ../ and absolute paths."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr(zipfile.ZipInfo(name), data)
    buf.seek(0)
    return zipfile.ZipFile(buf)


PACKAGE = {
    'Brochure/Brochure.idml': b'idml',
    'Brochure/Brochure.pdf': b'pdf',
    'Brochure/Links/photo.jpg': b'j' * 1000,
    'Brochure/Links/.DS_Store': b'',
    'Brochure/Document Fonts/Font.otf': b'otf',
    'Brochure/Instructions.txt': b'unused',
    '__MACOSX/Brochure/._Brochure.idml': b'apple',
}


def test_plans_package_from_directory():
    package = read_package(make_zip(PACKAGE))
    assert package.folder == 'Brochure'
    assert package.idml.filename == 'Brochure/Brochure.idml'
    assert package.links == [('photo.jpg', 1000)]
    assert [i.filename for i in package.fonts] == ['Brochure/Document Fonts/Font.otf']
    assert [i.filename for i in package.pdfs] == ['Brochure/Brochure.pdf']


def test_extracts_only_what_checks_read(tmp_path):
    zf = make_zip(PACKAGE)
    folder, idml = extract_package(zf, read_package(zf), str(tmp_path))
    assert folder == str(tmp_path / 'Brochure')
    assert idml == str(tmp_path / 'Brochure' / 'Brochure.idml')
    written = sorted(os.path.relpath(os.path.join(d, f), tmp_path) for d, _, fs in os.walk(tmp_path) for f in fs)
    assert written == [os.path.join('Brochure', 'Brochure.idml'), os.path.join('Brochure', 'Brochure.pdf'),
                       os.path.join('Brochure', 'Document Fonts', 'Font.otf')]


def test_idml_at_zip_root():
    package = read_package(make_zip({'Doc.idml': b'i', 'links/a.png': b'aa'}))
    assert package.folder == ''
    assert package.links == [('a.png', 2)]


@pytest.mark.parametrize('entries, error', [
    ({'Brochure/readme.txt': b''}, NoIdmlError),
    ({'a/b/deep.idml': b''}, NoIdmlError),
    ({'A.idml': b'', 'B.idml': b''}, MultipleIdmlError),
    ({'One/A.idml': b'', 'Two/B.idml': b''}, MultipleIdmlError),
])
def test_idml_must_be_single(entries, error):
    with pytest.raises(error):
        read_package(make_zip(entries))


@pytest.mark.parametrize('name', ['../evil.idml', 'Pkg/../../evil.idml', '/abs/evil.idml', 'C:/evil.idml', '..\\evil.idml'])
def test_rejects_paths_that_escape(name):
    with pytest.raises(PackageError, match='unsafe paths'):
        read_package(raw_name_zip(name))


def test_rejects_package_that_unpacks_too_large(monkeypatch):
    monkeypatch.setattr(package_zip, 'MAX_PACKAGE_EXTRACTED_BYTES', 10_000)
    # 1 MB of zeros compresses to about 1 KB: a small upload that would unpack far past the limit.
    with pytest.raises(PackageError, match='unpacks to'):
        read_package(make_zip({'Doc.idml': b'i', 'Doc.pdf': b'\0' * 1_000_000}))


def test_large_links_do_not_count_towards_extraction_limit(monkeypatch):
    monkeypatch.setattr(package_zip, 'MAX_PACKAGE_EXTRACTED_BYTES', 10_000)
    package = read_package(make_zip({'Doc.idml': b'i', 'Links/big.tif': b'\0' * 1_000_000}))
    assert package.links == [('big.tif', 1_000_000)]


def test_rejects_too_many_entries(monkeypatch):
    monkeypatch.setattr(package_zip, 'MAX_PACKAGE_ENTRIES', 5)
    with pytest.raises(PackageError, match='too many files'):
        read_package(make_zip({f'Links/{i}.png': b'' for i in range(6)} | {'Doc.idml': b''}))


def _write_idml(tmp_path, entries):
    path = tmp_path / 'Doc.idml'
    path.write_bytes(make_zip(entries).fp.getvalue())
    return str(path)


def test_extract_idml(tmp_path):
    idml = _write_idml(tmp_path, {'designmap.xml': b'<x/>', 'Stories/Story_u1.xml': b'<s/>'})
    extract_idml(idml, str(tmp_path / 'out'))
    assert (tmp_path / 'out' / 'Stories' / 'Story_u1.xml').read_bytes() == b'<s/>'


def test_extract_idml_rejects_bomb(tmp_path, monkeypatch):
    monkeypatch.setattr(package_zip, 'MAX_IDML_EXTRACTED_BYTES', 10_000)
    idml = _write_idml(tmp_path, {'Stories/Story_u1.xml': b'\0' * 1_000_000})
    with pytest.raises(PackageError, match='unpacks to'):
        extract_idml(idml, str(tmp_path / 'out'))
    assert not (tmp_path / 'out').exists()


def test_extract_idml_rejects_escape(tmp_path):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr(zipfile.ZipInfo('../../escaped.xml'), b'x')
    path = tmp_path / 'Doc.idml'
    path.write_bytes(buf.getvalue())
    with pytest.raises(PackageError, match='unsafe paths'):
        extract_idml(str(path), str(tmp_path / 'out'))
    assert not (tmp_path.parent / 'escaped.xml').exists()


def test_damaged_idml(tmp_path):
    path = tmp_path / 'Doc.idml'
    path.write_bytes(b'not a zip')
    with pytest.raises(PackageError, match='damaged'):
        extract_idml(str(path), str(tmp_path / 'out'))
