"""src/model layout and assets read every package exactly like the old parsers (plan PR 2.2): spreads, text
frames, links, pasted graphics, transform and wrap candidates, master spreads, page geometry, packaged images and
fonts, and the Fonts.xml catalog. On every distinct package in the corpus, plus built packages for what the corpus
lacks (text wrap, master items). Removed with the old classes in PR 2.5."""
import collections
import glob
import hashlib
import os
import tempfile
import zipfile

import pytest

from src.helpers import safe_xml
from src.helpers.package_zip import extract_idml, extract_package, read_package
from src.helpers.page_geometry import PageGeometryIndex
from src.parsers.FontsParser import FontsParser
from src.parsers.MasterPageParser import MasterPageParser
from src.parsers.SourceFoldersParser import SourceFoldersParser
from src.parsers.SpreadsParser import SpreadsParser
from src.model.assets import load_font_catalog, packaged_fonts, packaged_images
from src.model.layout import load_layout

TRANSFORM_TAGS = {'TextFrame', 'Rectangle', 'Oval', 'Polygon', 'Group'}
WRAP_TAGS = {'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'Group'}


def unique_packages(testing_dir):
    seen = {}
    for path in sorted(glob.glob(os.path.join(testing_dir, '**', '*.zip'), recursive=True)):
        with zipfile.ZipFile(path) as zf:
            try:
                package = read_package(zf)
            except Exception:
                continue
            digest = hashlib.sha256(zf.read(package.idml)).hexdigest() + str(sorted(package.links))
        seen.setdefault(digest, path)
    return list(seen.values())


def unpack(path, dest):
    with zipfile.ZipFile(path) as zf:
        package = read_package(zf)
        folder, idml = extract_package(zf, package, dest)
    idml_folder = os.path.join(dest, 'Source XML')
    extract_idml(idml, idml_folder)
    fonts = next((os.path.join(folder, d) for d in os.listdir(folder) if d.lower() == 'document fonts'), None)
    return idml_folder, package.links, fonts


def old_frame(f):
    return (f.frame_id, f.parent_story_id, f.applied_object_style, f.auto_sizing_type, f.auto_sizing_reference_point,
            f.use_no_line_breaks, f.text_column_count, f.linked_text_frame, f.text_wrap_mode, f.is_auto_size)


def new_frame(f):
    return (f.id, f.story_id, f.object_style, f.auto_size, f.auto_size_reference_point, f.no_line_breaks, f.columns,
            f.previous_frame != 'n' or f.next_frame != 'n', f.wrap, bool(f.auto_size and f.auto_size != 'Off'))


def old_link(l):
    return (l.link_id, l.resource_uri, l.stored_state, l.link_name, l.image_object_style, l.item_transform,
            l.container_object_style, l.container_item_transform, l.grandparent_link_id)


def new_link(l):
    return (l.id, l.uri, l.stored_state, l.name, l.graphic_object_style, l.graphic_transform, l.frame_object_style,
            l.frame_transform, l.frame_id)


def compare(path):
    """Mismatches between old and new, as (what, detail)."""
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        idml_folder, link_files, fonts_folder = unpack(path, tmp)
        layout = load_layout(idml_folder)
        new_spreads = {s.id: s for s in layout.spreads}
        spreads_dir = os.path.join(idml_folder, 'Spreads')
        old_spreads = {s.spread_self: s for s in SpreadsParser(spreads_dir).spreads_obj_list} if os.path.isdir(spreads_dir) else {}
        if set(old_spreads) != set(new_spreads):
            out.append(('spread ids', (sorted(old_spreads), sorted(new_spreads))))
        for sid in set(old_spreads) & set(new_spreads):
            o, n = old_spreads[sid], new_spreads[sid]
            pairs = {
                'pages': ([(p['self'], p['name']) for p in o.pages], [(p.id, p.name) for p in n.pages]),
                'text frames': ([old_frame(f) for f in o.text_frame_obj_list], [new_frame(f) for f in n.text_frames]),
                'links': ([old_link(l) for l in o.links_obj_list], [new_link(l) for l in n.links]),
                'pasted': (o.pasted_graphics_num, sum(1 for i in n.items if i.pasted)),
                'stories': (o.child_stories, list(dict.fromkeys(f.story_id for f in n.text_frames if f.story_id))),
                'transform candidates': ([(c['tag'], c['self_id'], c['item_transform']) for c in o.page_item_transform_candidates],
                                         [(i.kind, i.id, i.transform) for i in n.items if i.kind in TRANSFORM_TAGS
                                          and not (i.kind == 'Rectangle' and i.has_link) and i.transform and i.transform.strip()]),
                'wrap items': ([(w['tag'], w['self_id'], w['mode']) for w in o.wrap_items],
                               [(i.kind, i.id, i.wrap) for i in n.items if i.kind in WRAP_TAGS and i.wrap not in (None, 'None')]),
            }
            out += [(f'spread {sid}: {what}', pair) for what, pair in pairs.items() if pair[0] != pair[1]]
        masters_dir = os.path.join(idml_folder, 'MasterSpreads')
        old_masters = MasterPageParser(masters_dir if os.path.isdir(masters_dir) else None)
        masters = {
            'master items': (collections.Counter(old_masters.unexpected_elements),
                             collections.Counter(t for m in layout.masters for t in m.child_tags if t not in ('Properties', 'Page'))),
            'master links': (collections.Counter(old_link(l) for l in old_masters.links_obj_list),
                             collections.Counter(new_link(l) for m in layout.masters for l in m.links)),
        }
        out += [(what, pair) for what, pair in masters.items() if pair[0] != pair[1]]
        old_geometry, new_geometry = PageGeometryIndex(idml_folder), layout.geometry
        if old_geometry.get_pages() != new_geometry.get_pages():
            out.append(('geometry pages', (old_geometry.get_pages(), new_geometry.get_pages())))
        for self_id in set(old_geometry._elements) | set(new_geometry._elements):
            if old_geometry.get_bounds(self_id) != new_geometry.get_bounds(self_id):
                out.append(('bounds', (self_id, old_geometry.get_bounds(self_id), new_geometry.get_bounds(self_id))))
        if old_geometry.get_page_frames() != new_geometry.get_page_frames():
            out.append(('page frames', ''))
        old_assets = SourceFoldersParser(link_files, fonts_folder or tmp)
        assets = {
            'images': ([(i.image_name, i.image_size_bytes, i.image_size_MB) for i in old_assets.images_obj_list],
                       [(i.name, i.size_bytes, i.size_mb) for i in packaged_images(link_files)]),
        }
        if fonts_folder:
            assets['fonts'] = ([(f.font_family, f.postscript_name, f.extension, f.variable_font, not f.font_error) for f in old_assets.document_fonts],
                               [(f.family, f.postscript_name, f.extension, f.variable, f.readable) for f in packaged_fonts(fonts_folder)])
        fonts_xml = os.path.join(idml_folder, 'Resources', 'Fonts.xml')
        if os.path.exists(fonts_xml):
            old_fonts, catalog = FontsParser(fonts_xml), load_font_catalog(fonts_xml)
            assets['catalog'] = ([(f.font_family, f.variable_font, {s: (v['postscript'], v['typekit']) for s, v in f.faces.items()})
                                  for f in old_fonts.font_families_from_xml],
                                 [(f.name, f.variable, {s: (v.postscript, v.typekit) for s, v in f.faces.items()}) for f in catalog.families])
            assets['catalog lookup'] = ([next((f.font_family for f in old_fonts.font_families_from_xml if f.font_family == f2.name), None) for f2 in catalog.families],
                                        [catalog.family(f2.name).name for f2 in catalog.families])
        out += [(what, pair) for what, pair in assets.items() if pair[0] != pair[1]]
    return out



TESTING_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACKAGES = unique_packages(TESTING_DIR)


def test_corpus_is_covered():
    assert len(PACKAGES) > 90


@pytest.mark.parametrize('path', PACKAGES, ids=[os.path.relpath(p, TESTING_DIR) for p in PACKAGES])
def test_corpus_package(path):
    assert compare(path) == []


def _built(tmp_path, build):
    from testing.fixtures.idml_builder import PackageBuilder
    pkg = PackageBuilder(pages=2, masters=2)
    pkg.text_frame(pkg.story([('Body', 'Hello')]), wrap='BoundingBoxTextWrap', columns=2, auto_size='HeightOnly')
    build(pkg)
    return pkg.write(tmp_path)


@pytest.mark.parametrize('build', [
    pytest.param(lambda pkg: (pkg.shape('Oval', wrap='Contour'), pkg.shape('GraphicLine', page=1, wrap='JumpObjectTextWrap'),
                              pkg.group(wrap='BoundingBoxTextWrap')), id='wrap'),
    pytest.param(lambda pkg: (pkg.shape('Polygon', pasted='EPS'), pkg.shape('Rectangle', pasted='PDF', page=1)), id='pasted'),
    pytest.param(lambda pkg: (pkg.image('a.jpg', master=0), pkg.image('b.png', master=1, embedded=True),
                              pkg.image('c.jpg', page=1, image_transform='-1 0 0 1 0 0')), id='master-items'),
])
def test_built_package(tmp_path, build):
    assert compare(_built(tmp_path, build)) == []


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
