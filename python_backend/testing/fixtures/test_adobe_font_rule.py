"""Adobe Fonts: Frontify only loads fonts from the package (Document fonts + AdobeFnt*.lst, by PostScript
name) and never from Adobe; the TypekitID is copied into the template but never read. InDesign packages
Adobe Fonts in some cases, and then they work. So an Adobe Font is an error only when its files aren't
packaged, reported once as ADOBE_FONT instead of FONTS_INCLUDED (docs/rules-review-2026-10-12.md)."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

ADOBE_ID = 'TkD-6851-d71d4646b2'


def run_with_fonts(tmp_path, adobe=True, packaged=(), other_missing=False):
    pkg = PackageBuilder()
    # InDesign writes an empty '$ID/' TypekitID for desktop fonts.
    typekit = ADOBE_ID if adobe else '$ID/'
    pkg.font_family('Cloud Sans', {'Regular': ('CloudSans-Regular', typekit), 'Bold': ('CloudSans-Bold', typekit)})
    for style in packaged:
        pkg.document_font('Cloud Sans', style, f'CloudSans-{style}')
    pkg.paragraph_style('Body', font='Cloud Sans', FontStyle='Regular')
    runs = [('Text ', {}), ('bold', {'FontStyle': 'Bold'})]
    if other_missing:
        pkg.font_family('Desk Serif', {'Regular': ('DeskSerif-Regular', '$ID/')})
        runs.append(('serif', {'AppliedFont': 'Desk Serif', 'FontStyle': 'Regular'}))
    pkg.text_frame(pkg.story([('Body', runs)]))
    return run_checker(pkg.write(tmp_path))


def test_unpackaged_adobe_font_is_an_error_once(tmp_path):
    run = run_with_fonts(tmp_path)
    assert [(i.severity, i.subject, i.detail) for i in run.of('ADOBE_FONT')] == [('error', 'Cloud Sans', '')]
    assert run.of('FONTS_INCLUDED') == []


def test_packaged_adobe_font_is_fine(tmp_path):
    run = run_with_fonts(tmp_path, packaged=('Regular', 'Bold'))
    assert run.of('ADOBE_FONT') == []
    assert run.of('FONTS_INCLUDED') == []


def test_partly_packaged_adobe_font_names_missing_styles(tmp_path):
    run = run_with_fonts(tmp_path, packaged=('Regular',))
    assert [i.detail for i in run.of('ADOBE_FONT')] == ['Missing styles: Bold']


def test_other_missing_fonts_still_reported(tmp_path):
    run = run_with_fonts(tmp_path, other_missing=True)
    assert [i.subject for i in run.of('ADOBE_FONT')] == ['Cloud Sans']
    assert [i.subject for i in run.of('FONTS_INCLUDED')] == ['Desk Serif']


def test_desktop_font_is_not_an_adobe_font(tmp_path):
    run = run_with_fonts(tmp_path, adobe=False)
    assert run.of('ADOBE_FONT') == []
    assert [i.subject for i in run.of('FONTS_INCLUDED')] == ['Cloud Sans']


def test_only_the_adobe_styles_count_as_adobe(tmp_path):
    """A family can mix Adobe and desktop styles; each missing style is reported under its own source."""
    pkg = PackageBuilder()
    pkg.font_family('Mixed', {'Regular': ('Mixed-Regular', '$ID/'), 'Italic': ('Mixed-Italic', ADOBE_ID),
                              'Bold': ('Mixed-Bold', '$ID/')})
    pkg.document_font('Mixed', 'Bold', 'Mixed-Bold')
    pkg.paragraph_style('Body', font='Mixed', FontStyle='Regular')
    pkg.text_frame(pkg.story([('Body', [('a', {}), ('b', {'FontStyle': 'Italic'}), ('c', {'FontStyle': 'Bold'})])]))
    run = run_checker(pkg.write(tmp_path))
    assert [i.detail for i in run.of('FONTS_INCLUDED')] == ['Missing styles: Regular']
    assert [i.detail for i in run.of('ADOBE_FONT')] == ['Missing styles: Italic']


def test_absent_family_used_only_in_a_desktop_style_is_not_adobe(tmp_path):
    pkg = PackageBuilder()
    pkg.font_family('Mixed', {'Regular': ('Mixed-Regular', '$ID/'), 'Italic': ('Mixed-Italic', ADOBE_ID)})
    pkg.paragraph_style('Body', font='Mixed', FontStyle='Regular')
    pkg.text_frame(pkg.story([('Body', 'Regular only')]))
    run = run_checker(pkg.write(tmp_path))
    assert [i.subject for i in run.of('FONTS_INCLUDED')] == ['Mixed']
    assert run.of('ADOBE_FONT') == []
