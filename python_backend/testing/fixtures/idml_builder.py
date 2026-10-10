"""Build tiny, valid template packages in memory, so each edge case is a short readable test.

Defaults produce a clean package: every check passes. A test changes only what it is about:

    pkg = PackageBuilder()
    story = pkg.story([('Body', 'Hello')])
    pkg.text_frame(story, columns=2)          # -> one TEXT_COLUMNS error
    results = run_checker(pkg.write(tmp_path))

Pages are US Letter (612 x 792 pt). Frame positions are page-local (x, y, width, height) in points.
"""
import io
import os
import zipfile
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple
from xml.sax.saxutils import quoteattr, escape

PAGE_W, PAGE_H = 612, 792
NS = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"'

# The root paragraph style carries a passing value for everything the checks read.
ROOT_PARAGRAPH_STYLE = {
    'KerningMethod': '$ID/Metrics', 'Composer': 'HL Single', 'GridAlignment': 'None',
    'Hyphenation': 'false', 'FillTint': '-1',
}
DEFAULT_TEXT_FRAME_STYLE = 'ObjectStyle/$ID/[Normal Text Frame]'
DEFAULT_GRAPHIC_STYLE = 'ObjectStyle/$ID/[None]'


def _attrs(values: Dict[str, Optional[str]]) -> str:
    return ' '.join(f'{k}={quoteattr(str(v))}' for k, v in values.items() if v is not None)


def _rect_path(x: float, y: float, w: float, h: float) -> str:
    points = [(x, y), (x, y + h), (x + w, y + h), (x + w, y)]
    anchors = ''.join(f'<PathPointType Anchor="{px} {py}" LeftDirection="{px} {py}" RightDirection="{px} {py}"/>'
                      for px, py in points)
    return (f'<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>{anchors}'
            f'</PathPointArray></GeometryPathType></PathGeometry></Properties>')


@dataclass
class _Paragraph:
    style: str
    runs: List[Tuple[str, Dict[str, str]]]  # (text, character-range attributes)
    attrs: Dict[str, str]


@dataclass
class PackageBuilder:
    name: str = 'Template'
    pages: int = 1                      # 2 = one facing-page spread
    master_spreads: bool = True
    bleed: str = '0'
    _paragraph_styles: Dict[str, Dict] = field(default_factory=dict)
    _character_styles: Dict[str, Dict] = field(default_factory=dict)
    _stories: Dict[str, List[_Paragraph]] = field(default_factory=dict)
    _items: List[str] = field(default_factory=list)
    _links: Dict[str, bytes] = field(default_factory=dict)
    _next_id: int = 0x100

    def __post_init__(self):
        self.paragraph_style('Body')

    def _id(self) -> str:
        self._next_id += 1
        return f'u{self._next_id:x}'

    # --- styles ----------------------------------------------------------------------------
    def paragraph_style(self, name: str, based_on: Optional[str] = None, **attrs: str):
        """A paragraph style; inherits from [No paragraph style] unless based_on names another style."""
        self._paragraph_styles[name] = {'based_on': based_on, 'attrs': attrs}

    def character_style(self, name: str, based_on: Optional[str] = None, **attrs: str):
        self._character_styles[name] = {'based_on': based_on, 'attrs': attrs}

    # --- content ---------------------------------------------------------------------------
    def story(self, paragraphs: Sequence, story_id: Optional[str] = None) -> str:
        """paragraphs: (paragraph style name, text) or (style, [(text, {char-range attrs}), ...], {para attrs})."""
        story_id = story_id or self._id()
        parsed = []
        for p in paragraphs:
            style, content = p[0], p[1]
            runs = [(content, {})] if isinstance(content, str) else list(content)
            parsed.append(_Paragraph(style, runs, p[2] if len(p) > 2 else {}))
        self._stories[story_id] = parsed
        return story_id

    def text_frame(self, story_id: str, page: int = 0, at=(72, 72, 200, 100), *, columns: int = 1,
                   wrap: Optional[str] = 'None', object_style: str = DEFAULT_TEXT_FRAME_STYLE,
                   auto_size: Optional[str] = None, reference_point: Optional[str] = None,
                   no_line_breaks: Optional[bool] = None, previous: str = 'n', next: str = 'n',
                   transform: Optional[str] = None) -> str:
        frame_id = self._id()
        pref = _attrs({'TextColumnCount': str(columns), 'AutoSizingType': auto_size or 'Off',
                       'AutoSizingReferencePoint': reference_point,
                       'UseNoLineBreaksForAutoSizing': None if no_line_breaks is None else str(no_line_breaks).lower()})
        wrap_xml = f'<TextWrapPreference TextWrapMode="{wrap}"/>' if wrap is not None else ''
        self._items.append(
            f'<TextFrame {_attrs({"Self": frame_id, "ParentStory": story_id, "PreviousTextFrame": previous, "NextTextFrame": next, "AppliedObjectStyle": object_style, "ItemTransform": transform or self._page_transform(page)})}>'
            f'{_rect_path(*at)}<TextFramePreference {pref}/>{wrap_xml}</TextFrame>')
        return frame_id

    def image(self, file_name: str, page: int = 0, at=(72, 300, 200, 150), *, include_in_links: bool = True,
              embedded: bool = False, image_transform: str = '1 0 0 1 0 0', frame_transform: Optional[str] = None,
              frame_style: str = DEFAULT_GRAPHIC_STYLE, image_style: str = DEFAULT_GRAPHIC_STYLE,
              size_bytes: int = 1024) -> str:
        frame_id, image_id, link_id = self._id(), self._id(), self._id()
        if include_in_links:
            self._links[file_name] = b'\0' * size_bytes
        stored = 'Embedded' if embedded else 'Normal'
        self._items.append(
            f'<Rectangle {_attrs({"Self": frame_id, "ContentType": "GraphicType", "AppliedObjectStyle": frame_style, "ItemTransform": frame_transform or self._page_transform(page)})}>'
            f'{_rect_path(*at)}'
            f'<Image {_attrs({"Self": image_id, "AppliedObjectStyle": image_style, "ItemTransform": image_transform})}>'
            f'<Link {_attrs({"Self": link_id, "LinkResourceURI": f"file:/Users/designer/{self.name}/Links/{file_name}", "StoredState": stored})}/>'
            f'</Image></Rectangle>')
        return frame_id

    def _page_transform(self, page: int) -> str:
        """Page-local coordinates -> spread coordinates (the spread origin is at the spine, mid-height)."""
        x = -PAGE_W * self.pages / 2 + PAGE_W * page if self.pages > 1 else 0
        return f'1 0 0 1 {x} {-PAGE_H / 2}'

    # --- output ----------------------------------------------------------------------------
    def _styles_xml(self) -> str:
        root = _attrs({'Self': 'ParagraphStyle/$ID/[No paragraph style]', 'Name': '$ID/[No paragraph style]', **ROOT_PARAGRAPH_STYLE})
        paragraphs = [f'<ParagraphStyle {root}/>',
                      '<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle">'
                      '<Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn></Properties></ParagraphStyle>']
        for name, s in self._paragraph_styles.items():
            base = s['based_on'] or '$ID/[No paragraph style]'
            base = base if base.startswith('$ID/') else f'ParagraphStyle/{base}'
            paragraphs.append(f'<ParagraphStyle {_attrs({"Self": f"ParagraphStyle/{name}", "Name": name, **s["attrs"]})}>'
                              f'<Properties><BasedOn type="string">{escape(base)}</BasedOn></Properties></ParagraphStyle>')
        characters = ['<CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/>']
        for name, s in self._character_styles.items():
            base = s['based_on'] or '$ID/[No character style]'
            base = base if base.startswith('$ID/') else f'CharacterStyle/{base}'
            characters.append(f'<CharacterStyle {_attrs({"Self": f"CharacterStyle/{name}", "Name": name, **s["attrs"]})}>'
                              f'<Properties><BasedOn type="string">{escape(base)}</BasedOn></Properties></CharacterStyle>')
        return (f'<idPkg:Styles {NS}><RootCharacterStyleGroup>{"".join(characters)}</RootCharacterStyleGroup>'
                f'<RootParagraphStyleGroup>{"".join(paragraphs)}</RootParagraphStyleGroup></idPkg:Styles>')

    def _story_xml(self, story_id: str, paragraphs: List[_Paragraph]) -> str:
        body = ''
        for p in paragraphs:
            style = p.style if p.style.startswith('$ID/') else p.style
            runs = ''.join(
                f'<CharacterStyleRange {_attrs({"AppliedCharacterStyle": attrs.pop("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]"), **attrs})}>'
                f'<Content>{escape(text)}</Content></CharacterStyleRange>'
                for text, attrs in ((t, dict(a)) for t, a in p.runs))
            body += f'<ParagraphStyleRange {_attrs({"AppliedParagraphStyle": f"ParagraphStyle/{style}", **p.attrs})}>{runs}</ParagraphStyleRange>'
        return f'<idPkg:Story {NS}><Story Self="{story_id}">{body}</Story></idPkg:Story>'

    def _spread_xml(self) -> str:
        pages = ''.join(
            f'<Page Self="page{i}" Name="{i + 1}" GeometricBounds="0 0 {PAGE_H} {PAGE_W}" ItemTransform="{self._page_transform(i)}"/>'
            for i in range(self.pages))
        return f'<idPkg:Spread {NS}><Spread Self="spread1" PageCount="{self.pages}">{pages}{"".join(self._items)}</Spread></idPkg:Spread>'

    def idml_bytes(self) -> bytes:
        files = {
            'mimetype': 'application/vnd.adobe.indesign-idml-package',
            'designmap.xml': f'<Document {NS}>'
                             + ('<idPkg:MasterSpread src="MasterSpreads/MasterSpread_m1.xml"/>' if self.master_spreads else '')
                             + '<idPkg:Spread src="Spreads/Spread_spread1.xml"/>'
                             + ''.join(f'<idPkg:Story src="Stories/Story_{s}.xml"/>' for s in self._stories)
                             + '</Document>',
            'Resources/Fonts.xml': f'<idPkg:Fonts {NS}/>',
            'Resources/Styles.xml': self._styles_xml(),
            'Resources/Preferences.xml': f'<idPkg:Preferences {NS}><DocumentPreference '
                                         + ' '.join(f'DocumentBleed{k}Offset="{self.bleed}"' for k in ('Top', 'Bottom', 'InsideOrLeft', 'OutsideOrRight'))
                                         + '/></idPkg:Preferences>',
            'Spreads/Spread_spread1.xml': self._spread_xml(),
        }
        if self.master_spreads:
            files['MasterSpreads/MasterSpread_m1.xml'] = (
                f'<idPkg:MasterSpread {NS}><MasterSpread Self="m1"><Properties/><Page Self="mpage1"/></MasterSpread></idPkg:MasterSpread>')
        for story_id, paragraphs in self._stories.items():
            files[f'Stories/Story_{story_id}.xml'] = self._story_xml(story_id, paragraphs)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            for name, text in files.items():
                zf.writestr(name, '<?xml version="1.0" encoding="UTF-8"?>' + text if name.endswith('.xml') else text)
        return buf.getvalue()

    def write(self, directory) -> str:
        """Write the package zip (Name/Name.idml + Name/Links/...) and return its path."""
        path = os.path.join(str(directory), f'{self.name}.zip')
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(f'{self.name}/{self.name}.idml', self.idml_bytes())
            for file_name, data in self._links.items():
                zf.writestr(f'{self.name}/Links/{file_name}', data)
        return path
