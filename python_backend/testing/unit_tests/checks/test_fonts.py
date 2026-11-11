from types import SimpleNamespace

from src.checks.fonts import _missing_styles
from src.model.assets import PackagedFont, load_font_catalog


def test_family_named_differently_from_its_files_is_found_by_postscript_name(tmp_path):
    """InDesign wrote 'Acme Sans (OTF)' twice (a TrueType family with the italics, then the CFF one); the packaged
    files call their family 'Acme Sans'. Frontify merges the two entries and loads the files by PostScript name."""
    fonts_xml = tmp_path / 'Fonts.xml'
    fonts_xml.write_text(
        '<Fonts>'
        '<FontFamily Name="Acme Sans (OTF)"><Font FontStyleName="Italic" PostScriptName="AcmeSans-Italic"/></FontFamily>'
        '<FontFamily Name="Acme Sans (OTF)"><Font FontStyleName="Regular" PostScriptName="AcmeSans-Regular"/>'
        '<Font FontStyleName="Bold" PostScriptName="AcmeSans-Bold"/></FontFamily>'
        '</Fonts>')
    family = load_font_catalog(str(fonts_xml)).family('Acme Sans (OTF)')
    doc = SimpleNamespace(
        packaged_fonts=(PackagedFont('AcmeSans-Regular.otf', 'Acme Sans', 'AcmeSans-Regular', '.otf', False, True),),
        faces_used_with=lambda name: {'Regular', 'Bold'})

    assert _missing_styles(doc, family) == (False, ['Bold'])
