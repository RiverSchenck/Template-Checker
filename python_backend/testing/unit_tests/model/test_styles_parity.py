"""The new StyleSheet resolves every style property exactly like the old StylesParser + PropertyBase, on every
distinct Styles.xml in the test corpus (plan PR 2.1). Removed with the old classes in PR 2.5."""
import glob
import hashlib
import io
import os
import zipfile

import pytest

from src.classes.PropertyBase import PropertyBase
from src.model.styles import load_styles
from src.parsers.StylesParser import StylesParser

TESTING_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# What the checks resolve today; every other property is compared too.
CHECKED = {'AppliedFont', 'FontStyle', 'Hyphenation', 'GridAlignment', 'Composer', 'KerningMethod', 'FillTint',
           'Position', 'BaselineShift'}


def styles_files():
    """(package, Styles.xml bytes) for each distinct Styles.xml in the corpus."""
    seen = {}
    for package in sorted(glob.glob(os.path.join(TESTING_DIR, '**', '*.zip'), recursive=True)):
        with zipfile.ZipFile(package) as outer:
            idmls = [n for n in outer.namelist() if n.lower().endswith('.idml') and '__MACOSX' not in n]
            if len(idmls) != 1:
                continue
            with zipfile.ZipFile(io.BytesIO(outer.read(idmls[0]))) as idml:
                if 'Resources/Styles.xml' in idml.namelist():
                    data = idml.read('Resources/Styles.xml')
                    seen.setdefault(hashlib.sha256(data).hexdigest(), (os.path.relpath(package, TESTING_DIR), data))
    return list(seen.values())


FILES = styles_files()


def test_corpus_has_styles():
    assert len(FILES) > 50


@pytest.mark.parametrize('package, data', FILES, ids=[package for package, _ in FILES])
def test_resolve_matches_property_base(tmp_path, package, data):
    path = tmp_path / 'Styles.xml'
    path.write_bytes(data)
    old, new = StylesParser(str(path)), load_styles(str(path))
    mismatches = []
    for styles in (old.paragraph_styles, old.character_styles):
        # BasedOn is the style's parent (Style.based_on), not a property, in the new model.
        props = CHECKED | {prop for style in styles.values() for prop in style} - {'BasedOn'}
        for style_id in styles:
            for prop in props:
                before, after = PropertyBase(style_id, old, prop), new.resolve(style_id, prop)
                value = before.value or None
                inherited = (before.inherited_from or None) if value else None
                if (value, inherited) != (after.value, after.inherited_from(style_id)):
                    mismatches.append((style_id, prop, (value, inherited), (after.value, after.inherited_from(style_id))))
    assert not mismatches, mismatches[:10]
