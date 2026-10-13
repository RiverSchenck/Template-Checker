"""src/model/styles.py: Styles.xml parsed once, values resolved through BasedOn (plan PR 2.1, B7)."""
import pytest

from src.model.styles import UNSET, Resolved, load_styles

STYLES = '''<?xml version="1.0" encoding="UTF-8"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
<RootCharacterStyleGroup>
  <CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/>
  <CharacterStyle Self="CharacterStyle/ParagraphStyle copy" Name="ParagraphStyle copy" KerningMethod="$ID/Optical">
    <Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties>
  </CharacterStyle>
</RootCharacterStyleGroup>
<RootParagraphStyleGroup>
  <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" KerningMethod="$ID/Metrics" FillTint="-1"/>
  <ParagraphStyle Self="ParagraphStyle/Base" Name="Base" KerningMethod="$ID/Optical" Composer="" BulletsFont="$ID/">
    <Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><AppliedFont type="string">Arial</AppliedFont></Properties>
  </ParagraphStyle>
  <ParagraphStyleGroup Self="ParagraphStyleGroup/Headings" Name="Headings">
    <ParagraphStyle Self="ParagraphStyle/Headings%3aH1" Name="H1" FontStyle="Bold">
      <Properties><BasedOn type="object">ParagraphStyle/Base</BasedOn><AppliedFont type="string">Helvetica</AppliedFont></Properties>
    </ParagraphStyle>
  </ParagraphStyleGroup>
  <ParagraphStyle Self="ParagraphStyle/LoopA" Name="LoopA"><Properties><BasedOn type="object">ParagraphStyle/LoopB</BasedOn></Properties></ParagraphStyle>
  <ParagraphStyle Self="ParagraphStyle/LoopB" Name="LoopB"><Properties><BasedOn type="object">ParagraphStyle/LoopA</BasedOn></Properties></ParagraphStyle>
</RootParagraphStyleGroup>
<RootObjectStyleGroup>
  <ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]" Name="$ID/[Normal Text Frame]"/>
</RootObjectStyleGroup>
</idPkg:Styles>'''


@pytest.fixture(scope='module')
def sheet(tmp_path_factory):
    path = tmp_path_factory.mktemp('styles') / 'Styles.xml'
    path.write_text(STYLES, encoding='utf-8')
    return load_styles(str(path))


def test_style_identity(sheet):
    h1 = sheet.get('ParagraphStyle/Headings%3aH1')
    assert (h1.kind, h1.name, h1.based_on) == ('paragraph', 'H1', 'ParagraphStyle/Base')
    root = sheet.get('ParagraphStyle/$ID/[No paragraph style]')
    assert (root.name, root.based_on) == ('[No paragraph style]', None)
    assert sheet.get('ObjectStyle/$ID/[Normal Text Frame]').kind == 'object'


def test_kind_comes_from_the_element_not_the_id(sheet):
    # B7: the old code treated any id containing "ParagraphStyle" as a paragraph style.
    style = sheet.get('CharacterStyle/ParagraphStyle copy')
    assert style.kind == 'character'
    assert sheet.resolve(style.id, 'KerningMethod') == Resolved('Optical', style.id)


def test_value_set_on_the_style(sheet):
    assert sheet.resolve('ParagraphStyle/Headings%3aH1', 'FontStyle') == Resolved('Bold', 'ParagraphStyle/Headings%3aH1')
    assert sheet.resolve('ParagraphStyle/Headings%3aH1', 'AppliedFont').value == 'Helvetica'  # a Properties child


def test_value_inherited_through_based_on(sheet):
    kerning = sheet.resolve('ParagraphStyle/Headings%3aH1', 'KerningMethod')
    assert kerning == Resolved('Optical', 'ParagraphStyle/Base')
    assert kerning.inherited_from('ParagraphStyle/Headings%3aH1') == 'ParagraphStyle/Base'
    assert sheet.resolve('ParagraphStyle/Base', 'FillTint') == Resolved('-1', 'ParagraphStyle/$ID/[No paragraph style]')


def test_empty_values_are_unset_and_inherit(sheet):
    assert sheet.resolve('ParagraphStyle/Base', 'Composer') == UNSET            # Composer=""
    assert sheet.resolve('ParagraphStyle/Base', 'BulletsFont') == UNSET         # BulletsFont="$ID/"


@pytest.mark.parametrize('style_id', [None, '', 'ParagraphStyle/Missing', 'ParagraphStyle/LoopA'])
def test_no_value_is_unset_never_an_error(sheet, style_id):
    # B7: the old code raised on a None style id. A BasedOn loop stops.
    assert sheet.resolve(style_id, 'KerningMethod') == UNSET


def test_resolution_is_memoized(sheet):
    assert sheet.resolve('ParagraphStyle/Headings%3aH1', 'KerningMethod') is \
        sheet.resolve('ParagraphStyle/Headings%3aH1', 'KerningMethod')
