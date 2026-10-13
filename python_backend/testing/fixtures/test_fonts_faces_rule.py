"""Fonts included: Frontify loads font files per face, by PostScript name, and text set in a font through a
character style needs its files too. A missing style of a packaged family is an error that names the style
(docs/rules-review-2026-10-12.md)."""
from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder

BRAND = {'Regular': ('Brand-Regular', None), 'Bold': ('Brand-Bold', None)}


def font_issues(tmp_path, *, faces=BRAND, files=('Regular', 'Bold'), bold_via='character style',
                accent_family=None):
    pkg = PackageBuilder()
    pkg.font_family('Brand', faces)
    for style in files:
        pkg.document_font('Brand', style, f'Brand-{style}')
    pkg.paragraph_style('Body', font='Brand', FontStyle='Regular')
    if bold_via == 'character style':
        pkg.character_style('Strong', FontStyle='Bold')
        bold = {'AppliedCharacterStyle': 'CharacterStyle/Strong'}
    else:
        bold = {'FontStyle': 'Bold'}
    runs = [('Regular ', {}), ('bold', bold)]
    if accent_family:
        pkg.font_family(accent_family, {'Regular': (f'{accent_family}-Regular', None)})
        pkg.character_style('Accent', font=accent_family)
        runs.append(('accent', {'AppliedCharacterStyle': 'CharacterStyle/Accent'}))
    pkg.text_frame(pkg.story([('Body', runs)]))
    return run_checker(pkg.write(tmp_path)).of('FONTS_INCLUDED')


def test_all_faces_packaged(tmp_path):
    assert font_issues(tmp_path) == []


def test_missing_bold_used_through_character_style(tmp_path):
    issues = font_issues(tmp_path, files=('Regular',))
    assert [(i.subject, i.detail) for i in issues] == [('Brand', 'Missing styles: Bold')]


def test_missing_bold_set_on_the_text(tmp_path):
    issues = font_issues(tmp_path, files=('Regular',), bold_via='text')
    assert [i.detail for i in issues] == ['Missing styles: Bold']


def test_family_with_no_files_reported_without_styles(tmp_path):
    issues = font_issues(tmp_path, files=())
    assert [(i.subject, i.detail) for i in issues] == [('Brand', '')]


def test_family_used_only_through_a_character_style(tmp_path):
    issues = font_issues(tmp_path, accent_family='Accent')
    assert [i.subject for i in issues] == ['Accent']


def test_face_without_postscript_name_falls_back_to_family(tmp_path):
    faces = {'Regular': ('Brand-Regular', None), 'Bold': (None, None)}
    assert font_issues(tmp_path, faces=faces, files=('Regular',)) == []
