"""src/model/layout.py: every file is parsed once, spreads come in designmap order (plan PR 2.2)."""
import collections
import os
import zipfile

from src.helpers import safe_xml
from src.helpers.package_zip import extract_idml, extract_package, read_package
from src.model.layout import load_layout
from testing.fixtures.idml_builder import PackageBuilder


def unpack(path, dest):
    with zipfile.ZipFile(path) as zf:
        package = read_package(zf)
        folder, idml = extract_package(zf, package, dest)
    idml_folder = os.path.join(dest, 'Source XML')
    extract_idml(idml, idml_folder)
    fonts = next((os.path.join(folder, d) for d in os.listdir(folder) if d.lower() == 'document fonts'), None)
    return idml_folder, package.links, fonts


def _built(tmp_path, build):
    pkg = PackageBuilder(pages=2, masters=2)
    pkg.text_frame(pkg.story([('Body', 'Hello')]), wrap='BoundingBoxTextWrap', columns=2, auto_size='HeightOnly')
    build(pkg)
    return pkg.write(tmp_path)


def test_each_spread_file_is_parsed_once(tmp_path, monkeypatch):
    parsed = collections.Counter()
    real = safe_xml.parse

    def counting(path, **kwargs):
        parsed[os.path.relpath(path, idml_folder)] += 1
        return real(path, **kwargs)
    idml_folder, _, _ = unpack(_built(tmp_path, lambda pkg: None), str(tmp_path / 'unpacked'))
    monkeypatch.setattr(safe_xml, 'parse', counting)
    load_layout(idml_folder)
    assert parsed == {'designmap.xml': 1, 'Spreads/Spread_spread1.xml': 1,
                      'MasterSpreads/MasterSpread_m1.xml': 1, 'MasterSpreads/MasterSpread_m2.xml': 1}


def test_spreads_follow_designmap_order(tmp_path):
    idml_folder, _, _ = unpack(_built(tmp_path, lambda pkg: None), str(tmp_path / 'unpacked'))
    designmap = os.path.join(idml_folder, 'designmap.xml')
    with open(designmap) as f:
        text = f.read()
    with open(designmap, 'w') as f:  # list the masters in reverse
        f.write(text.replace('MasterSpread_m1.xml', 'MasterSpread_TMP.xml').replace('MasterSpread_m2.xml', 'MasterSpread_m1.xml')
                .replace('MasterSpread_TMP.xml', 'MasterSpread_m2.xml'))
    assert [m.id for m in load_layout(idml_folder).masters] == ['m2', 'm1']
