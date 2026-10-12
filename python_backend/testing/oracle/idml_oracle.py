"""An independent second opinion on the checker's results.

Reads the IDML straight from the uploaded package with plain lxml and works out, from InDesign's
own data model, which items each check should report. It deliberately shares no code with src/,
so a bug in the checker's parsing can't hide itself here.

Each function returns a set of (identifier, data_id, detail) tuples. The comparison test lines
these up against the checker's results (the golden JSON).
"""
import io
import math
import zipfile
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from lxml import etree as ET

Item = Tuple[str, str, str]


def _parse(data: bytes):
    return ET.fromstring(data, ET.XMLParser(huge_tree=True))


def _last(style_id: str) -> str:
    """'ParagraphStyle/$ID/NormalParagraphStyle' -> 'NormalParagraphStyle', 'ParagraphStyle/Body' -> 'Body'."""
    for prefix in ('ParagraphStyle/$ID/', 'ParagraphStyle/', 'CharacterStyle/$ID/', 'CharacterStyle/'):
        if style_id.startswith(prefix):
            return style_id[len(prefix):]
    return style_id


@dataclass
class Idml:
    spreads: List = field(default_factory=list)
    stories: List = field(default_factory=list)
    styles: object = None
    preferences: object = None

    @classmethod
    def from_package(cls, package_path: str) -> Optional['Idml']:
        """None when the package doesn't hold exactly one .idml (the checker rejects those up front)."""
        with zipfile.ZipFile(package_path) as pkg:
            names = [n for n in pkg.namelist()
                     if n.lower().endswith('.idml') and not n.startswith('__MACOSX/') and n.count('/') <= 1]
            if len(names) != 1:
                return None
            idml = zipfile.ZipFile(io.BytesIO(pkg.read(names[0])))
        files = sorted(idml.namelist())
        return cls(
            spreads=[_parse(idml.read(n)) for n in files if n.startswith('Spreads/')],
            stories=[_parse(idml.read(n)) for n in files if n.startswith('Stories/')],
            styles=_parse(idml.read('Resources/Styles.xml')),
            preferences=_parse(idml.read('Resources/Preferences.xml')),
        )

    # --- lookups -------------------------------------------------------------------------------
    def frames(self):
        return [f for spread in self.spreads for f in spread.iter('TextFrame')]

    def links(self):
        return [link for spread in self.spreads for link in spread.iter('Link')]

    def style_table(self, kind: str) -> Dict[str, object]:
        return {s.get('Self'): s for s in self.styles.iter(kind)}

    def resolve(self, kind: str, style_id: str, attr: str) -> Tuple[Optional[str], Optional[str]]:
        """Follow BasedOn until a style sets `attr`. Returns (value, style it came from)."""
        table, seen = self.style_table(kind), set()
        while style_id in table and style_id not in seen:
            seen.add(style_id)
            style = table[style_id]
            if style.get(attr) is not None:
                return style.get(attr), style_id
            based_on = style.find('Properties/BasedOn')
            if based_on is None or not based_on.text:
                break
            text = based_on.text
            style_id = text if text.startswith(kind + '/') else f'{kind}/{text}'
        return None, None

    def paragraph_ranges(self):
        return [r for story in self.stories for r in story.iter('ParagraphStyleRange')]


# --- checks --------------------------------------------------------------------------------------

def text_columns(doc: Idml) -> Set[Item]:
    out = set()
    for f in doc.frames():
        pref = f.find('TextFramePreference')
        count = pref.get('TextColumnCount') if pref is not None else None
        if count not in (None, '1'):
            out.add(('', f.get('Self'), count))
    return out


def text_wrap(doc: Idml) -> Set[Item]:
    """InDesign's default is no wrap, so a frame without a TextWrapPreference has none."""
    out = set()
    for f in doc.frames():
        pref = f.find('TextWrapPreference')
        mode = pref.get('TextWrapMode') if pref is not None else 'None'
        if mode != 'None':
            out.add(('', f.get('Self'), mode))
    return out


def linked_text_frames(doc: Idml) -> Set[Item]:
    return {('', f.get('Self'), '') for f in doc.frames()
            if f.get('PreviousTextFrame') != 'n' or f.get('NextTextFrame') != 'n'}


def embedded_images(doc: Idml) -> Set[Item]:
    # Link > Image (the placed graphic) > Rectangle (the frame); issues point at the frame.
    return {('', link.getparent().getparent().get('Self'), '') for link in doc.links()
            if link.get('StoredState') == 'Embedded'}


def _classify(transform: Optional[str]) -> Optional[str]:
    """ItemTransform is 'a b c d tx ty'. Classified from the matrix itself, not by mirroring the checker:
    - determinant a*d - b*c < 0 means the item is mirrored: a flip (e.g. '-1 0 0 1' flips horizontally;
      '-1 0 0 -1' is a 180 degree turn, not a flip);
    - otherwise the angle of the x axis, atan2(b, a), is the rotation;
    - an unrotated item whose axes aren't perpendicular (c != 0 or b != 0) is skewed.
    """
    if not transform:
        return None
    a, b, c, d = map(float, transform.split()[:4])
    if a * d - b * c < 0:
        return 'flip'
    angle = math.degrees(math.atan2(b, a))
    if abs(angle) > 0.01:
        return f'rotation {angle:.2f}'
    if abs(b) > 0.01 or abs(c) > 0.01:
        return 'skew'
    return None


def image_transformations(doc: Idml) -> Set[Item]:
    out = set()
    for link in doc.links():
        image, frame = link.getparent(), link.getparent().getparent()
        for element, where in ((image, 'image'), (frame, 'container')):
            kind = _classify(element.get('ItemTransform'))
            if kind:
                out.add((where, frame.get('Self'), kind))
    return out


def document_bleed(doc: Idml) -> Set[Item]:
    pref = doc.preferences.find('.//DocumentPreference')
    keys = ('DocumentBleedTopOffset', 'DocumentBleedBottomOffset',
            'DocumentBleedInsideOrLeftOffset', 'DocumentBleedOutsideOrRightOffset')
    values = [pref.get(k) for k in keys] if pref is not None else []
    return {('', '', ','.join(values))} if any(v != '0' for v in values) else set()


def paragraph_kerning(doc: Idml) -> Set[Item]:
    """Kerning is judged on the paragraph style (through BasedOn). A value set directly on the text is an
    override, which the overrides check reports, so it's deliberately ignored here."""
    out = set()
    for p in doc.paragraph_ranges():
        value, _ = doc.resolve('ParagraphStyle', p.get('AppliedParagraphStyle'), 'KerningMethod')
        if value and value.replace('$ID/', '') != 'Metrics':
            out.add((_last(p.get('AppliedParagraphStyle')), '', value.replace('$ID/', '')))
    return out


def character_kerning(doc: Idml) -> Set[Item]:
    """Same rule for character styles: only the style's own (or inherited) KerningMethod counts."""
    out = set()
    for p in doc.paragraph_ranges():
        for r in p.findall('CharacterStyleRange'):
            value, _ = doc.resolve('CharacterStyle', r.get('AppliedCharacterStyle'), 'KerningMethod')
            if value and value.replace('$ID/', '') != 'Metrics':
                out.add((_last(r.get('AppliedCharacterStyle')), '', value.replace('$ID/', '')))
    return out


def _once_per_style(doc: Idml, attr: str, is_issue) -> Set[Item]:
    """Checks that report each paragraph style once, with where its value was inherited from.
    Like kerning, only the style counts; values set directly on the text are overrides."""
    out, seen = set(), set()
    for p in doc.paragraph_ranges():
        style_id = p.get('AppliedParagraphStyle')
        value, source = doc.resolve('ParagraphStyle', style_id, attr)
        if is_issue(value) and style_id not in seen:
            seen.add(style_id)
            inherited = source if source and source != style_id else ''
            out.add((_last(style_id), '', f'Inherited from: {inherited}' if inherited else ''))
    return out


def composer(doc: Idml) -> Set[Item]:
    return _once_per_style(doc, 'Composer', lambda v: v != 'HL Single')


def grid_alignment(doc: Idml) -> Set[Item]:
    return _once_per_style(doc, 'GridAlignment', lambda v: v not in (None, 'None'))
