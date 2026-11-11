from types import SimpleNamespace

from src.checks.fonts import _missing_styles
from src.model.assets import PackagedFont, load_font_catalog


def test_family_named_differently_from_its_files_is_found_by_postscript_name(tmp_path):
    """InDesign wrote 'DW Pangea (OTF)' twice (a TrueType family with the italics, then the CFF one); the packaged
    files call their family 'DW Pangea'. Frontify merges the two entries and loads the files by PostScript name."""
    fonts_xml = tmp_path / 'Fonts.xml'
    fonts_xml.write_text(
        '<Fonts>'
        '<FontFamily Name="DW Pangea (OTF)"><Font FontStyleName="Italic" PostScriptName="DWPangea-Italic"/></FontFamily>'
        '<FontFamily Name="DW Pangea (OTF)"><Font FontStyleName="Regular" PostScriptName="DWPangea-Regular"/>'
        '<Font FontStyleName="Bold" PostScriptName="DWPangea-Bold"/></FontFamily>'
        '</Fonts>')
    family = load_font_catalog(str(fonts_xml)).family('DW Pangea (OTF)')
    doc = SimpleNamespace(
        packaged_fonts=(PackagedFont('DWPangea-Regular.otf', 'DW Pangea', 'DWPangea-Regular', '.otf', False, True),),
        faces_used_with=lambda name: {'Regular', 'Bold'})

    assert _missing_styles(doc, family) == (False, ['Bold'])
