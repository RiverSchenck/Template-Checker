"""XML from an uploaded package is parsed safely and can't point the checker outside its run folder (S1, S2)."""
import base64
import contextlib
import io
import os
import time
import zipfile

import pytest
from lxml import etree

from src.helpers import safe_xml
from src.helpers.package_zip import DAMAGED_IDML
from src.helpers.page_geometry import PageGeometryIndex
from src.helpers.pdf_previews import xmp_thumbnails
from src.pipeline.run import run
from src.pipeline.workspace import run_workspace
from testing.fixtures.idml_builder import PackageBuilder

ENTITIES = '<!ENTITY a0 "xxxxxxxxxx">' + ''.join(f'<!ENTITY a{i} "{("&a%d;" % (i - 1)) * 10}">' for i in range(1, 10))
BILLION_LAUGHS = f'<?xml version="1.0"?><!DOCTYPE d [{ENTITIES}]><d>&a9;</d>'


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return str(path)


def test_parses_a_normal_file(tmp_path):
    assert safe_xml.parse(write(tmp_path / 'a.xml', '<a><b Self="u1"/></a>')).getroot().find('b').get('Self') == 'u1'


@pytest.mark.parametrize('large', [False, True])
def test_billion_laughs_fails_fast(tmp_path, large):
    path = write(tmp_path / 'Spread.xml', BILLION_LAUGHS)
    start = time.monotonic()
    with pytest.raises((safe_xml.UnsafeXMLError, etree.XMLSyntaxError)):
        safe_xml.parse(path, large=large)
    assert time.monotonic() - start < 2


def test_external_entity_is_never_read(tmp_path):
    outside_file = write(tmp_path / 'outside.txt', 'OUTSIDE')
    path = write(tmp_path / 'a.xml', f'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file://{outside_file}">]><a>&x;</a>')
    with pytest.raises(safe_xml.UnsafeXMLError, match='DTD'):
        safe_xml.parse(path)


def test_any_dtd_is_refused(tmp_path):
    with pytest.raises(safe_xml.UnsafeXMLError, match='a.xml declares a DTD'):
        safe_xml.parse(write(tmp_path / 'a.xml', '<?xml version="1.0"?><!DOCTYPE a [<!ELEMENT a ANY>]><a/>'))


def test_large_files_can_hold_huge_text_up_to_the_cap(tmp_path, monkeypatch):
    path = write(tmp_path / 'Spread.xml', f'<a>{"x" * 11_000_000}</a>')  # over libxml2's 10 MB text limit
    with pytest.raises(etree.XMLSyntaxError):
        safe_xml.parse(path)
    assert len(safe_xml.parse(path, large=True).getroot().text) == 11_000_000
    monkeypatch.setattr(safe_xml, 'MAX_LARGE_FILE_BYTES', 10_000_000)
    with pytest.raises(safe_xml.UnsafeXMLError, match='larger than'):
        safe_xml.parse(path, large=True)


def test_within(tmp_path):
    folder = tmp_path / 'idml'
    folder.mkdir()
    (tmp_path / 'outside').mkdir()
    os.symlink(tmp_path / 'outside', folder / 'link')
    assert safe_xml.within(str(folder), 'Spreads/Spread_u1.xml') == os.path.join(str(folder), 'Spreads/Spread_u1.xml')
    for escape in ('../outside/x.xml', 'Spreads/../../outside/x.xml', str(tmp_path / 'outside' / 'x.xml'), 'link/x.xml'):
        assert safe_xml.within(str(folder), escape) is None, escape


def test_designmap_src_outside_the_idml_folder_is_ignored(tmp_path):
    spread = '<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"><Spread Self="{}">' \
             '<Page Self="{}" Name="1" GeometricBounds="0 0 100 100" ItemTransform="1 0 0 1 0 0"/></Spread></idPkg:Spread>'
    write(tmp_path / 'outside.xml', spread.format('s_out', 'p_out'))
    folder = tmp_path / 'idml'
    write(folder / 'Spreads' / 'Spread_s1.xml', spread.format('s1', 'p1'))
    write(folder / 'designmap.xml', '<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">'
                                    '<idPkg:Spread src="../outside.xml"/><idPkg:Spread src="Spreads/Spread_s1.xml"/></Document>')
    assert [page['page_id'] for page in PageGeometryIndex(str(folder)).get_pages()] == ['p1']


def test_preview_thumbnails_are_read_without_writing_files(tmp_path):
    jpeg = base64.b64encode(b'\xff\xd8 not really a jpeg').decode()
    xmp = ('<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
           'xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpTPg="http://ns.adobe.com/xap/1.0/t/pg/" '
           'xmlns:xmpGImg="http://ns.adobe.com/xap/1.0/g/img/"><rdf:RDF><rdf:Description><xmp:PageInfo><rdf:Seq>'
           + ''.join(f'<rdf:li><xmpTPg:PageNumber>{n}</xmpTPg:PageNumber><xmpGImg:image>{jpeg}</xmpGImg:image></rdf:li>'
                     for n in ('1', '../../escaped'))
           + '</rdf:Seq></xmp:PageInfo></rdf:Description></rdf:RDF></x:xmpmeta>')
    metadata = write(tmp_path / 'run' / 'META-INF' / 'metadata.xml', xmp)
    thumbnails = xmp_thumbnails(metadata)
    assert thumbnails['1'] == jpeg  # a page number like '../../escaped' is only a key; it matches no page
    assert [p for p in tmp_path.rglob('*') if p.is_file()] == [tmp_path / 'run' / 'META-INF' / 'metadata.xml']


def test_checker_stops_at_parse_xml_on_a_hostile_spread(tmp_path):
    idml = zipfile.ZipFile(io.BytesIO(PackageBuilder().idml_bytes()))
    hostile = io.BytesIO()
    with zipfile.ZipFile(hostile, 'w') as z:
        for name in idml.namelist():
            data = idml.read(name)
            if name.startswith('Spreads/'):
                data = data.replace(b'?>', f'?><!DOCTYPE x [{ENTITIES}]>'.encode(), 1).replace(b'PageCount="1">', b'PageCount="1">&a9;')
            z.writestr(name, data)
    package = tmp_path / 'Template.zip'
    with zipfile.ZipFile(package, 'w') as z:
        z.writestr('Template/Template.idml', hostile.getvalue())
    start = time.monotonic()
    with run_workspace() as workspace, contextlib.redirect_stdout(io.StringIO()):
        outcome = run(str(package), workspace)
    assert outcome.stage.name == 'PARSE_XML'
    assert [issue.context for issue in outcome.results] == [DAMAGED_IDML]
    assert time.monotonic() - start < 5
